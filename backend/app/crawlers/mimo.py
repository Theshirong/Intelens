"""小米 MiMo 官网新闻抓取与解析

站点: https://mimo.mi.com

列表枚举不解析页面: 新闻页 /docs/zh-CN/news 是客户端渲染的, 静态 HTML
里没有任何文章链接, 因此改从 sitemap.xml 过滤 /docs/zh-CN/news/ 前缀。

文章页为服务端渲染 (SolidStart), 正文结构::

    <div class="mdxContent">
        <h1 class="mdx-h1">标题</h1>
        <p class="mdx-p">…</p>
        <h2 class="mdx-h2" id="…">…</h2>
        <img class="mdx-img" src="https://…">        # 外链 CDN
        <video class="mdx-video" src="https://….mp4"> # 外链 CDN
        <ul class="mdx-ul">…</ul>
    </div>
    <div class="flex flex-col items-end w-full">更新时间 2026 年 06 月 15 日</div>

「更新时间」与正文容器是兄弟节点, 不会混进正文; 站点不提供发布时间,
该字段是目前唯一的时间来源, 且只有日粒度, 入库按当天 00:00 处理。
"""

import asyncio
import re
from datetime import datetime
from urllib.parse import urljoin

import lxml.etree
from loguru import logger
from markdownify import markdownify as html_to_md

from app.crawlers.base import BaseCrawler, CrawlerError, RawNewsItem
from app.models.source_model import SourceModel

# 并发上限: 对单一站点同时打太多请求既不礼貌也容易被限速
CONCURRENCY = 5

# 站点 sitemap, 是新闻列表唯一可靠的来源
SITEMAP_PATH = "/sitemap.xml"
# 只取中文新闻; 英文版 (/docs/en-US/news/) 是同一批稿件的翻译, 重复入库无意义
NEWS_PATH_PREFIX = "/docs/zh-CN/news/"

# 正文里需要清理的隐形/坏字符: 零宽空格(锚点)、BOM、源码中损坏的字节(U+FFFD)
INVISIBLE_CHARS = re.compile("[\u200b\ufeff\ufffd]")

# markdown 里的站内相对链接, 如 ](/docs/xxx)
REL_LINK = re.compile(r"\]\((/[^)\s]*)\)")

# 页脚「更新时间 2026 年 06 月 15 日」: 数字与年月日之间存在空格和注释节点
UPDATE_TIME = re.compile(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日")

# 视频占位文本: 前端只渲染 markdown, 不认裸 <video>, 所以降级成可点击链接
VIDEO_PLACEHOLDER = "▶ 视频"


def _text(node: lxml.etree._Element) -> str:
    """节点全部文本 (跳过注释节点), 合并空白"""
    return re.sub(r"\s+", " ", "".join(node.itertext())).strip()


def _replace_videos(body: lxml.etree._Element) -> None:
    """把 <video src=…> 原地换成 <a>, 否则 markdownify 会静默丢掉整个视频"""
    for video in body.xpath(".//video"):
        src = (video.get("src") or "").strip()
        if not src:
            video.getparent().remove(video)
            continue
        link = lxml.etree.Element("a", href=src)
        link.text = VIDEO_PLACEHOLDER
        video.getparent().replace(video, link)


def _drop_empty_nodes(body: lxml.etree._Element) -> None:
    """去掉只有空白文本的标题节点, 否则 markdown 里会留下孤零零的 `##`"""
    for node in body.xpath(".//h1|.//h2|.//h3|.//h4"):
        if not _text(node):
            node.getparent().remove(node)


def parse_update_time(et: lxml.etree._Element) -> datetime | None:
    """取页脚「更新时间」作为发布时间

    匹配到的节点里取文本最短的那个, 避免抓到把整页包住的祖先节点;
    带「更新时间」但没跟日期的节点直接跳过。
    """
    hits = et.xpath("//div[contains(normalize-space(.), '更新时间')]")
    for node in sorted(hits, key=lambda n: len("".join(n.itertext()))):
        matched = UPDATE_TIME.search(" ".join(node.itertext()))
        if matched is None:
            continue
        year, month, day = (int(part) for part in matched.groups())
        try:
            return datetime(year, month, day)
        except ValueError:
            return None
    return None


def parse_article(html: str, page_url: str) -> tuple[str, str, datetime | None]:
    """从文章页 html 提取 (标题, 正文 markdown, 发布时间)

    正文里的相对链接补全为绝对地址; 图片与视频保持外链, 不镜像站方媒体。
    """
    et = lxml.etree.HTML(html)

    containers = et.xpath(
        "//div[contains(concat(' ', normalize-space(@class), ' '), ' mdxContent ')]"
    )
    if not containers:
        raise ValueError("未找到正文容器 mdxContent")
    body = containers[0]

    titles = body.xpath("./h1[contains(@class, 'mdx-h1')]")
    if not titles:
        raise ValueError("未找到标题节点 mdx-h1")
    h1 = titles[0]
    title = _text(h1)
    body.remove(h1)  # 标题单独存字段, 不重复进正文

    _replace_videos(body)
    _drop_empty_nodes(body)

    content = html_to_md(
        lxml.etree.tostring(body, encoding="unicode"), heading_style="ATX"
    )
    content = INVISIBLE_CHARS.sub("", content)
    content = REL_LINK.sub(lambda m: f"]({urljoin(page_url, m.group(1))})", content)
    # 收敛连续空行
    content = re.sub(r"\n{3,}", "\n\n", content).strip()

    return title, content, parse_update_time(et)


class MimoCrawler(BaseCrawler):
    """小米 MiMo 官网新闻 (mimo.mi.com/docs/zh-CN/news)"""

    async def fetch(self, source: SourceModel) -> list[RawNewsItem]:
        """抓取并解析源下全部新闻"""
        urls = await self._fetch_news_list(source)

        sem = asyncio.Semaphore(CONCURRENCY)
        results = await asyncio.gather(
            *(self._fetch_one(sem, source, url) for url in urls)
        )
        # 单篇失败已在 _fetch_one 内记日志跳过, 不会拖垮整个源
        return [item for item in results if item is not None]

    async def _fetch_news_list(self, source: SourceModel) -> list[str]:
        """从 sitemap 过滤出中文新闻 URL

        新闻页是客户端渲染的, 解析它拿不到任何文章链接, 所以改走 sitemap。
        """
        resp = await self._get(urljoin(source.url, SITEMAP_PATH), source)
        try:
            et = lxml.etree.fromstring(resp.content)
        except lxml.etree.XMLSyntaxError as e:
            raise CrawlerError(
                "sitemap 不是合法 XML", source_name=source.name, url=str(resp.url)
            ) from e

        # local-name() 避免依赖 sitemap 的命名空间前缀
        locs = et.xpath("//*[local-name()='loc']/text()")
        urls = sorted({loc.strip() for loc in locs if NEWS_PATH_PREFIX in loc})
        if not urls:
            raise CrawlerError(
                "sitemap 未解析到新闻链接",
                source_name=source.name,
                url=str(resp.url),
            )
        return urls

    async def _fetch_one(
        self, sem: asyncio.Semaphore, source: SourceModel, url: str
    ) -> RawNewsItem | None:
        """抓单篇并解析, 组装成一条完整记录; 失败返回 None"""
        try:
            async with sem:
                resp = await self._get(url, source)
            title, content, published_at = parse_article(resp.text, str(resp.url))
        except CrawlerError as e:
            logger.warning(f"跳过抓取失败的新闻: {e}")
            return None
        except (ValueError, IndexError) as e:
            # 正文结构变化导致解析失败
            logger.warning(f"跳过解析失败的新闻 {url}: {e!r}")
            return None

        return RawNewsItem(
            title=title,
            url=str(resp.url),
            content=content or None,
            published_at=published_at,
        )
