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

# 正文里需要清理的隐形/坏字符: 零宽空格(锚点)、BOM、源码中损坏的字节(U+FFFD)
INVISIBLE_CHARS = re.compile("[​﻿�]")

# markdown 里的站内相对链接/图片, 如 ](/zh-cn/img/xxx.png)
REL_LINK = re.compile(r"\]\((/[^)\s]*)\)")


def parse_article(html: str, page_url: str) -> tuple[str, str]:
    """从文章页 html 提取 (标题, 正文 markdown)

    正文里的相对链接/图片会补全为绝对地址, 前端无法解析站内相对路径。
    """
    et = lxml.etree.HTML(html)
    # 正文容器: div.theme-doc-markdown > div.row > div.col--12
    body = et.xpath("//div[contains(@class,'theme-doc-markdown')]/div/div")[0]

    h1 = body.xpath("./h1")[0]
    title = (h1.text or "").strip()
    body.remove(h1)  # 标题单独存字段, 不重复进正文

    # 标题旁的锚点链接是零宽字符, 删掉免得变成空链接 [](#xxx)
    for a in body.xpath(".//a[contains(@class,'hash-link')]"):
        a.getparent().remove(a)

    content = html_to_md(
        lxml.etree.tostring(body, encoding="unicode"), heading_style="ATX"
    )
    content = INVISIBLE_CHARS.sub("", content)
    content = REL_LINK.sub(lambda m: f"]({urljoin(page_url, m.group(1))})", content)
    # 收敛连续空行
    content = re.sub(r"\n{3,}", "\n\n", content).strip()
    return title, content


class DeepSeekCrawler(BaseCrawler):
    """DeepSeek 官网新闻 (api-docs.deepseek.com)"""

    async def fetch(self, source: SourceModel) -> list[RawNewsItem]:
        """抓取并解析源下全部新闻"""
        links = await self._fetch_news_list(source)

        sem = asyncio.Semaphore(CONCURRENCY)
        results = await asyncio.gather(
            *(self._fetch_one(sem, source, link) for link in links)
        )
        # 单篇失败已在 _fetch_one 内记日志跳过, 不会拖垮整个源
        return [item for item in results if item is not None]

    async def _fetch_news_list(self, source: SourceModel) -> list[dict]:
        """从首页进新闻页, 拿到全部新闻的 (短标题, 相对链接)"""
        base_url = source.url

        resp = await self._get(urljoin(base_url, "/zh-cn/"), source)
        et = lxml.etree.HTML(resp.text)
        try:
            # 首页导航里的「新闻」入口
            latest_news_url = et.xpath("//a[contains(text(), '新闻')]")[0].get("href")
        except IndexError:
            raise CrawlerError(
                "首页未找到新闻入口", source_name=source.name, url=str(resp.url)
            ) from None

        news_resp = await self._get(urljoin(base_url, latest_news_url), source)
        news_et = lxml.etree.HTML(news_resp.text)
        # li 内「新闻」分类节点下的兄弟 ul, 取其中所有文章链接
        items = news_et.xpath("//li[.//a[normalize-space(text())='新闻']]/ul/li/a")
        if not items:
            raise CrawlerError(
                "新闻列表页未解析到文章", source_name=source.name, url=str(news_resp.url)
            )
        return [{"sort_title": a.text.strip(), "news_url": a.get("href")} for a in items]

    async def _fetch_one(
        self, sem: asyncio.Semaphore, source: SourceModel, link: dict
    ) -> RawNewsItem | None:
        """抓单篇并解析, 组装成一条完整记录; 失败返回 None"""
        try:
            # 短标题格式: '<标题> YYYY/MM/DD'
            _, date_str = link["sort_title"].rsplit(" ", 1)
            published_at = datetime.strptime(date_str, "%Y/%m/%d")

            async with sem:
                resp = await self._get(urljoin(source.url, link["news_url"]), source)
            # resp.url 是 URL 对象, 且跟随重定向后为最终地址
            title, content = parse_article(resp.text, str(resp.url))
        except CrawlerError as e:
            logger.warning(f"跳过抓取失败的文章: {e}")
            return None
        except (ValueError, IndexError) as e:
            # 日期格式不符 / 正文结构变化导致解析失败
            logger.warning(f"跳过解析失败的文章 {link.get('news_url')}: {e!r}")
            return None

        return RawNewsItem(
            title=title,
            url=str(resp.url),
            content=content or None,  # 纯图片页(如「DeepSeek APP」)正文为空
            published_at=published_at,
        )
