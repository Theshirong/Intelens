"""月之暗面 Kimi 官网资讯抓取

站点: https://www.kimi.com

两个列表页都算资讯, 一起进 news 表:
- `/news/`      Kimi 资讯 (模型发布、产品更新)
- `/ai-models/` 官方模型介绍页 (如 /ai-models/kimi-k3), 卡片里也混有
                 /resources/xxx 形式的模型页

列表页是 Next.js 服务端渲染的, 两个页面的卡片结构一致 (标题带 card-title),
所以列表解析只有一份: 标题往上找覆盖卡片的链接, 日期从卡片文本里取
(/news/ 有「2026-09-17」, /ai-models/ 的卡片没有日期)。

详情页有两种版式:
- 文章页 (/news/xxx 与 /resources/xxx): 正文在 div.markdown 里, 标题在 hero 区;
  发布日期以页面 JSON-LD 的 datePublished 为准 —— 页面上展示的「更新于」是
  修改时间 (如 K2.7 Code 文章 6 月发布、9 月改过), 只在 JSON-LD 缺失时兜底。
- 模型介绍页 (/ai-models/xxx): 整页就是介绍内容, 没有正文容器, 把 main 转成
  markdown, 并截掉页尾的「探索更多模型 / 立即体验」导流区。

站点改版到解析不出卡片时抛 CrawlerError: 宁可这一轮不采集, 也不要把空列表
当成「官网没有新闻」。
"""

import asyncio
import json
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

# 两个列表页: 站方新闻 + 官方模型介绍
INDEX_PATHS = ("/news/", "/ai-models/")

# 卡片标题的类名, 两个列表页共用
CARD_TITLE = (
    "//*[contains(concat(' ', normalize-space(@class), ' '), ' card-title ')]"
)
# 卡片里的日期, 如「2026-09-17」
CARD_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")

# 文章正文容器: 新闻页与 /resources/ 模型页都带 markdown 类
MARKDOWN_BODY = (
    "//div[contains(concat(' ', normalize-space(@class), ' '), ' markdown ')]"
)
# hero 区的「更新于：2026-07-17」, JSON-LD 取不到日期时的兜底
UPDATED_AT = re.compile(r"更新于[:：]\s*(\d{4})-(\d{2})-(\d{2})")

# 正文里需要清理的隐形/坏字符: 零宽空格(锚点)、BOM、源码中损坏的字节(U+FFFD)
INVISIBLE_CHARS = re.compile("[\u200b\ufeff\ufffd]")
# markdown 里的站内相对链接/图片, 如 ](/ai-models/kimi-k3)
REL_LINK = re.compile(r"\]\((/[^)\s]*)\)")

# 模型介绍页正文之后的站内导流区, 从这里开始截断
PROMO_HEADING = re.compile(r"探索 Kimi|探索更多|更多能力|立即体验")
# 「常见问题」属于模型介绍内容, 保留; 它后面的相关模型列表与 CTA 才是导流
FAQ_HEADING = "常见问题"


def _text(node: lxml.etree._Element) -> str:
    """节点全部文本 (跳过注释节点), 合并空白"""
    return re.sub(r"\s+", " ", "".join(node.itertext())).strip()


def _absolute_links(markdown: str, page_url: str) -> str:
    """正文里的站内相对链接/图片补全为绝对地址, 前端无法解析站内相对路径"""
    return REL_LINK.sub(lambda m: f"]({urljoin(page_url, m.group(1))})", markdown)


def _replace_media(body: lxml.etree._Element) -> None:
    """把 iframe / video 换成 markdown 能表达的形式

    markdownify 会把 <iframe> 整块丢掉, <video> 也只留一个空标签。
    站方的视频地址由脚本注入, 静态 HTML 里只有封面图, 因此:
    <video> 用封面图代替, <iframe> 降级成带标题的链接。
    """
    for node in body.xpath(".//iframe"):
        src = (node.get("src") or "").strip()
        label = (node.get("title") or "").strip() or "▶ 嵌入内容"
        parent = node.getparent()
        if not src:
            parent.remove(node)
            continue
        link = lxml.etree.Element("a", href=src)
        link.text = label
        parent.replace(node, link)

    for node in body.xpath(".//video"):
        poster = (node.get("poster") or "").strip()
        label = (node.get("aria-label") or "").strip() or "▶ 视频"
        parent = node.getparent()
        if not poster:
            parent.remove(node)
            continue
        image = lxml.etree.Element("img", src=poster, alt=label)
        parent.replace(node, image)


def _to_markdown(body: lxml.etree._Element, page_url: str) -> str:
    """节点 -> markdown, 顺带清理隐形字符、补全相对链接、收敛空行"""
    content = html_to_md(
        lxml.etree.tostring(body, encoding="unicode"), heading_style="ATX"
    )
    content = INVISIBLE_CHARS.sub("", content)
    content = _absolute_links(content, page_url)
    return re.sub(r"\n{3,}", "\n\n", content).strip()


def _card_link(heading: lxml.etree._Element) -> tuple[str | None, lxml.etree._Element]:
    """卡片标题 -> (链接, 卡片节点)

    模型卡的标题 <h3> 直接包在 <a> 里; 资讯卡的标题 <h4> 与覆盖整卡的透明链接
    是兄弟节点, 所以要往上找到最近的「含链接的祖先」。
    """
    for node in heading.iterancestors("a"):
        if node.get("href"):
            return node.get("href"), node
    for node in heading.iterancestors():
        links = node.xpath(".//a[@href]")
        if links:
            return links[0].get("href"), node
    return None, heading


def parse_index(html: str, page_url: str) -> list[dict]:
    """列表页 -> [{title, url, published_at}], 链接已补全为绝对地址"""
    et = lxml.etree.HTML(html)
    entries: list[dict] = []
    seen: set[str] = set()

    for heading in et.xpath(CARD_TITLE):
        title = _text(heading)
        if not title:
            continue
        href, card = _card_link(heading)
        if not href:
            continue
        url = urljoin(page_url, href)
        if url in seen:
            continue
        seen.add(url)

        matched = CARD_DATE.search(_text(card))
        entries.append(
            {
                "title": title,
                "url": url,
                "published_at": (
                    datetime.strptime(matched.group(0), "%Y-%m-%d")
                    if matched
                    else None
                ),
            }
        )
    return entries


def _jsonld_article(et: lxml.etree._Element) -> dict | None:
    """页面 JSON-LD 里的 Article (标题、发布日期)"""
    for script in et.xpath("//script[@type='application/ld+json']"):
        try:
            data = json.loads(script.text or "")
        except (json.JSONDecodeError, TypeError):
            continue
        for node in data.get("@graph", [data]):
            if isinstance(node, dict) and node.get("@type") == "Article":
                return node
    return None


def _published_at(et: lxml.etree._Element, article: dict | None) -> datetime | None:
    """发布日期, 只取日期部分 (与其它源一致, 站点本身也只展示到天)

    优先 JSON-LD 的 datePublished; 取不到再读 hero 区的「更新于」。
    """
    raw = str((article or {}).get("datePublished") or "")
    matched = re.match(r"\d{4}-\d{2}-\d{2}", raw)
    if matched:
        return datetime.strptime(matched.group(0), "%Y-%m-%d")

    for node in et.xpath("//div[contains(@class, 'hero-block-props')]"):
        matched = UPDATED_AT.search(_text(node))
        if matched:
            year, month, day = (int(part) for part in matched.groups())
            return datetime(year, month, day)
    return None


def _trim_tail(root: lxml.etree._Element) -> None:
    """截掉模型介绍页页尾的站内导流区

    正文之后依次是「常见问题 → 探索更多模型 → 立即体验」: 常见问题算介绍内容,
    保留, 它后面的相关模型列表与 CTA 只是导流。站点改版找不到「常见问题」
    时, 退回按标题关键词截断。
    """
    sections = [
        node
        for node in root.xpath(".//section")
        if not node.xpath("ancestor::section")
    ]
    headings = [[_text(h) for h in node.xpath(".//h2")] for node in sections]

    cuts = [
        index
        for index, titles in enumerate(headings)
        if any(PROMO_HEADING.search(title) for title in titles)
    ]
    faq_at = max(
        (index for index, titles in enumerate(headings) if FAQ_HEADING in titles),
        default=None,
    )
    if faq_at is not None:
        cuts.append(faq_at + 1)
    if not cuts:
        return

    for node in sections[min(cuts) :]:
        parent = node.getparent()
        if parent is not None:
            parent.remove(node)


def _markdown_page(et: lxml.etree._Element, page_url: str) -> str:
    """没有正文容器的介绍页 (/ai-models/xxx): 整页转 markdown"""
    found = et.xpath("//main")
    root = found[0] if found else et.xpath("//body")[0]

    # 面包屑、脚本、页脚和悬浮 CTA 都不是介绍内容
    for node in root.xpath(".//script|.//style|.//nav|.//footer"):
        node.getparent().remove(node)
    for node in root.xpath(".//*[contains(@class, 'floating-cta')]"):
        node.getparent().remove(node)
    # 标题单独存字段, 不重复进正文 (与文章页一致)
    for node in root.xpath(".//h1"):
        node.getparent().remove(node)
    _trim_tail(root)

    return _to_markdown(root, page_url)


def parse_page(html: str, page_url: str) -> tuple[str, str, datetime | None]:
    """详情页 -> (标题, 正文 markdown, 发布日期)"""
    et = lxml.etree.HTML(html)
    article = _jsonld_article(et)

    titles = et.xpath("//h1")
    title = str((article or {}).get("headline") or "").strip() or (
        _text(titles[0]) if titles else ""
    )
    published_at = _published_at(et, article)

    bodies = et.xpath(MARKDOWN_BODY)
    if bodies:
        body = bodies[0]
        # 标题单独存字段, 不重复进正文 (正文容器里一般没有 h1, 这里防一手)
        for node in body.xpath(".//h1"):
            node.getparent().remove(node)
        _replace_media(body)
        content = _to_markdown(body, page_url)
    else:
        content = _markdown_page(et, page_url)

    return title, content, published_at


class KimiCrawler(BaseCrawler):
    """月之暗面 Kimi 官网资讯 (kimi.com/news 与 kimi.com/ai-models)"""

    async def fetch(self, source: SourceModel) -> list[RawNewsItem]:
        """抓取两个列表页下的全部资讯"""
        entries = await self._fetch_index(source)

        sem = asyncio.Semaphore(CONCURRENCY)
        results = await asyncio.gather(
            *(self._fetch_one(sem, source, entry) for entry in entries)
        )
        # 单篇失败已在 _fetch_one 内记日志跳过, 不会拖垮整个源
        return [item for item in results if item is not None]

    async def _fetch_index(self, source: SourceModel) -> list[dict]:
        """抓两个列表页并按链接去重 (同一页面只入库一次)"""
        entries: list[dict] = []
        seen: set[str] = set()

        for path in INDEX_PATHS:
            url = urljoin(source.url, path)
            try:
                resp = await self._get(url, source)
            except CrawlerError as e:
                # 单个列表页不可用不该拖掉另一个页面的资讯
                logger.warning(f"Kimi 列表页 {url} 抓取失败: {e}")
                continue
            found = parse_index(resp.text, str(resp.url))
            if not found:
                # 单个列表页改版不该拖掉另一个页面的资讯, 记日志后继续
                logger.warning(f"Kimi 列表页 {url} 未解析到资讯卡片, 可能改版")
            for entry in found:
                if entry["url"] in seen:
                    continue
                seen.add(entry["url"])
                entries.append(entry)

        if not entries:
            raise CrawlerError(
                "两个列表页都没解析到资讯", source_name=source.name, url=source.url
            )
        return entries

    async def _fetch_one(
        self, sem: asyncio.Semaphore, source: SourceModel, entry: dict
    ) -> RawNewsItem | None:
        """抓单篇并解析, 组装成一条完整记录; 失败返回 None"""
        try:
            async with sem:
                resp = await self._get(entry["url"], source)
            title, content, published_at = parse_page(resp.text, str(resp.url))
        except CrawlerError as e:
            logger.warning(f"跳过抓取失败的资讯: {e}")
            return None
        except (ValueError, IndexError) as e:
            # 正文结构变化导致解析失败
            logger.warning(f"跳过解析失败的资讯 {entry['url']}: {e!r}")
            return None

        return RawNewsItem(
            # 卡片标题是简称 (如「Kimi K3」), 详情页标题更完整时以详情页为准
            title=title or entry["title"],
            url=str(resp.url),
            content=content or None,
            # 模型介绍页没有发布日期, 退回列表卡片上的日期
            published_at=published_at or entry["published_at"],
        )
