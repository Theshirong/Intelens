"""智谱 Z.ai 研究文章抓取

站点 https://www.zhipuai.cn 是 Next.js 应用: **文章列表和正文都不在 DOM 里**,
而在 RSC 载荷 (self.__next_f.push 里的 JSON 字符串) 中。

载荷的正确解码方式: 每段 push 的第二个参数是一个 JS 字符串字面量,
用 json.loads 还原成真实文本后拼接。此前直接对整个 HTML 做
replace('\\"', '"') 粗暴反转义, 正文里出现英文引号时会破坏 JSON 边界,
导致部分文章取不到正文; 现在按段解码后不再有这个问题。

列表页 "blogsItems" 数组的每个条目自带 id / title_zh / createAt /
content_zh (Lexical 全文), 所以翻页抓列表就够, 不用再逐篇抓详情页。

因为没有自己的 RSS/API, 只能解析框架内部格式, 站点升级可能失效。因此:
解析不到足够条目时直接抛 CrawlerError —— 宁可这一轮不采集, 也不要把
"解析失败" 当成 "文章被删了" 写进库里。
"""

import json
import re
from datetime import datetime

from loguru import logger

from app.crawlers.base import BaseCrawler, CrawlerError, RawNewsItem
from app.models.source_model import SourceModel

# 研究/新闻列表页 (不带 tag 查询, 取全量)
RESEARCH_PATH = "/zh/research"
# 智谱的文档站与研究站不同域: 模型爬虫走 docs.bigmodel.cn, 新闻走 www.zhipuai.cn,
# sources 表里只存了一个 url, 所以这里用常量而不是 source.url
NEWS_BASE = "https://www.zhipuai.cn"

# 少于这个数量就认为解析失败, 不落库 (目前站点全量 18 篇)
MIN_EXPECTED_ITEMS = 5

# 翻页: 载荷里带 nextPage/hasMore, 逐页抓到 hasMore=false 为止
PAGE_PARAM = "page"
NEXT_PAGE = re.compile(r'"nextPage":(\d+),"hasMore":(true|false)')
# 防御: 万一站点把 hasMore 写成永远 true, 不要无限翻下去
MAX_PAGES = 20

# RSC 载荷按 self.__next_f.push([1,"..."]) 分段, 拼起来是一整个 JSON 流
PUSH_START = re.compile(r"self\.__next_f\.push\(")
# 列表数据在这个 key 下 (注意: 载荷里还有 navConfig 等结构也带文章,
# 不能按 {"id":..,"title_zh":..} 全文乱序匹配)
LIST_KEY = "blogsItems"


def _rsc_payload(html: str) -> str:
    """把页面里所有 self.__next_f.push 的字符串段解码并拼接

    每段的第二个参数是 JS 字符串字面量, json.loads 即可还原转义,
    这样载荷里的引号不会被破坏。
    """
    decoder = json.JSONDecoder()
    parts: list[str] = []
    for match in PUSH_START.finditer(html):
        try:
            chunk, _ = decoder.raw_decode(html[match.end() :])
        except json.JSONDecodeError:
            continue
        if isinstance(chunk, list) and len(chunk) >= 2 and isinstance(chunk[1], str):
            parts.append(chunk[1])
    return "".join(parts)


def _read_array(text: str, start: int) -> str | None:
    """从 start 处的 '[' 开始, 按「引号感知」的方括号配对取出完整 JSON 数组"""
    if start >= len(text) or text[start] != "[":
        return None
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return None


def parse_articles(html: str) -> list[dict]:
    """从列表页 RSC 载荷里解析出文章 (id, 标题, 发布日期, 正文)

    定位 "blogsItems" 数组后整体 json.loads, 不做逐条正则切分。
    返回的字典字段对齐 RawNewsItem。
    """
    payload = _rsc_payload(html)
    key_at = payload.find(f'"{LIST_KEY}":')
    if key_at < 0:
        return []

    raw_items = _read_array(payload, payload.find("[", key_at))
    if raw_items is None:
        return []

    try:
        items = json.loads(raw_items)
    except json.JSONDecodeError:
        return []
    if not isinstance(items, list):
        return []

    articles: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            published = datetime.strptime(item["createAt"][:10], "%Y-%m-%d")
        except (KeyError, TypeError, ValueError):
            continue
        title = str(item.get("title_zh") or "").strip()
        if not title:
            continue
        articles.append(
            {
                "id": str(item["id"]),
                "title": title,
                "published_at": published,
                "content_zh": item.get("content_zh"),
                "external_url": item.get("externalUrl_zh"),
            }
        )
    return articles


def _node_text(node: dict) -> str:
    """把 Lexical 节点的子文本拼起来; format 位 1 是加粗"""
    parts: list[str] = []
    for child in node.get("children") or []:
        if child.get("type") == "text":
            piece = child.get("text", "")
            if piece and child.get("format", 0) & 1:
                piece = f"**{piece}**"
            parts.append(piece)
        else:
            parts.append(_node_text(child))
    return "".join(parts)


def _lexical_to_markdown(data: dict) -> str | None:
    """Lexical 编辑器 JSON -> markdown

    只处理正文里实际出现的块类型 (标题/段落/列表/引用), 其余整块取纯文本。
    """
    children = (data.get("root") or {}).get("children") or []
    blocks: list[str] = []

    for node in children:
        node_type = node.get("type")
        if node_type == "heading":
            level = 3 if node.get("tag") == "h3" else 2
            text = _node_text(node).strip()
            if text:
                blocks.append("#" * level + " " + text)
        elif node_type == "list":
            lines = []
            for item in node.get("children") or []:
                text = _node_text(item).strip()
                if text:
                    lines.append(f"- {text}")
            if lines:
                blocks.append("\n".join(lines))
        elif node_type == "quote":
            text = _node_text(node).strip()
            if text:
                blocks.append("\n".join(f"> {line}" for line in text.splitlines()))
        else:
            # 段落以及其它块一律取纯文本, 空段落直接丢掉
            text = _node_text(node).strip()
            if text:
                blocks.append(text)

    return "\n\n".join(blocks) or None


class ZhipuCrawler(BaseCrawler):
    """智谱 Z.ai 研究文章 (zhipuai.cn/zh/research)"""

    async def fetch(self, source: SourceModel) -> list[RawNewsItem]:
        articles: dict[str, dict] = {}
        page: int | None = 1
        pages = 0

        # 逐页抓到 hasMore=false: 一页 15 篇, 官网总共 18 篇
        while page is not None and pages < MAX_PAGES:
            resp = await self._get(
                f"{NEWS_BASE}{RESEARCH_PATH}?{PAGE_PARAM}={page}", source
            )
            for article in parse_articles(resp.text):
                articles.setdefault(article["id"], article)
            pages += 1

            matched = NEXT_PAGE.search(_rsc_payload(resp.text))
            page = (
                int(matched.group(1))
                if matched is not None and matched.group(2) == "true"
                else None
            )

        if len(articles) < MIN_EXPECTED_ITEMS:
            raise CrawlerError(
                f"翻完 {pages} 页只解析到 {len(articles)} 篇文章, 疑似载荷格式变化",
                source_name=source.name,
                url=f"{NEWS_BASE}{RESEARCH_PATH}",
            )

        with_content = 0
        items: list[RawNewsItem] = []
        for article in sorted(
            articles.values(), key=lambda a: a["published_at"], reverse=True
        ):
            # 个别条目可能配置成外链 (externalUrl_zh), 有外链时
            # 官网列表本身就是跳转语义, 以外链为准; 否则用站内详情页
            url = article["external_url"] or (
                f"{NEWS_BASE}{RESEARCH_PATH}/{article['id']}"
            )
            content = _lexical_to_markdown(article["content_zh"] or {})
            with_content += bool(content)
            items.append(
                RawNewsItem(
                    title=article["title"],
                    url=url,
                    content=content,
                    published_at=article["published_at"],
                )
            )

        logger.info(
            f"智谱研究文章 {len(items)} 篇, 其中 {with_content} 篇取到正文"
        )
        return items
