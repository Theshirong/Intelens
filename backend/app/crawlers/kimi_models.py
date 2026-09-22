"""月之暗面 Kimi 开放平台「模型列表 & 推理定价」抓取

站点: https://platform.kimi.com (Mintlify 风格文档站, 与资讯站 kimi.com 不同域)

文档站每个页面都有纯 markdown 版本 (URL 加 `.md`), 而 HTML 里的价格表是
客户端渲染的 (静态 HTML 只剩组件代码), 所以这里直接抓 markdown:

- `/docs/models.md`        模型清单: 「多模态模型」表 (模型名 + 描述)
- `/docs/pricing/chat.md`  推理定价: DocTable 组件的 columns/rows 参数

「已下线模型」一节不解析 —— 这些历史型号由 save_models 按「本轮没抓到」置为
下架, 不需要人工维护名单。

注意: sources 表只存一个 url (资讯站), 所以平台域名用常量而不用 source.url,
与智谱 (新闻 zhipuai.cn / 文档 docs.bigmodel.cn) 的处理方式一致。
"""

import json
import re
from urllib.parse import urljoin

from app.crawlers.base import CrawlerError, ModelsCrawlerBase
from app.models.source_model import SourceModel

# 模型信息与定价页 (相对平台根域名), 末尾的 .md 是站方提供的纯文本版
MODELS_PATH = "/docs/models.md"
PRICING_PATH = "/docs/pricing/chat.md"

PLATFORM_BASE = "https://platform.kimi.com"

COMPANY = "kimi"

# 在售模型所在的小节标题; 官网自己的分组直接当 category
ACTIVE_SECTION = "多模态模型"

# DocTable 组件的两个参数块
COLUMNS_BLOCK = re.compile(r"columns=\{\[(.*?)\]\s*\}", re.S)
ROWS_BLOCK = re.compile(r"rows=\{\[(.*?)\]\s*\}", re.S)
# 列定义形如 { title: "输入价格（缓存未命中）", width: "16%" }
COLUMN_TITLE = re.compile(r'title:\s*"([^"]*)"')
# 行是 JS 数组字面量, 每行一个数组 (用正则配对出方括号内的内容再按 JSON 解析)
ARRAY_ROW = re.compile(r"\[([^\[\]]*)\]")

# 列名关键词 -> models 表价格字段, 与「元/百万 tokens」的语义一致
PRICE_COLUMNS = {
    "缓存命中": "price_input_hit_idle",
    "缓存未命中": "price_input_miss_idle",
    "输出价格": "price_output_idle",
}
NAME_COLUMN = "模型"
CONTEXT_COLUMN = "上下文窗口"

# "¥2.00" -> 2.00
PRICE = re.compile(r"[¥$]\s*([0-9]+(?:\.[0-9]+)?)")
# "1,048,576 tokens" -> 1048576
TOKEN_COUNT = re.compile(r"([0-9][0-9,]*)\s*tokens", re.IGNORECASE)
# markdown 表格里的 | 分隔行 (| --- | --- |)
TABLE_DIVIDER = re.compile(r"^[\s|:-]+$")


def _section(markdown: str, heading: str) -> str:
    """取出 markdown 里某个二级标题到下一个二级标题之间的内容"""
    start = markdown.find(f"## {heading}")
    if start < 0:
        return ""
    end = markdown.find("\n## ", start + 1)
    return markdown[start : end if end > 0 else len(markdown)]


def _table_rows(text: str) -> list[list[str]]:
    """markdown 表格 -> 二维文本矩阵 (分隔行丢掉)"""
    rows: list[list[str]] = []
    for line in text.splitlines():
        line = line.strip()
        if not (line.startswith("|") and line.endswith("|")):
            continue
        if TABLE_DIVIDER.match(line):
            continue
        rows.append([cell.strip() for cell in line.strip("|").split("|")])
    return rows


def _column(header: list[str], keyword: str) -> int | None:
    """按表头关键词定位列下标"""
    for index, name in enumerate(header):
        if keyword in name:
            return index
    return None


def _cell(row: list[str], index: int | None) -> str:
    if index is None or index >= len(row):
        return ""
    return row[index]


def _tokens(text: str) -> int | None:
    """'1,048,576 tokens' -> 1048576"""
    matched = TOKEN_COUNT.search(text)
    return int(matched.group(1).replace(",", "")) if matched else None


def _price(text: str) -> float | None:
    """'¥2.00' -> 2.0"""
    matched = PRICE.search(text)
    return float(matched.group(1)) if matched else None


def parse_models(markdown: str) -> list[dict]:
    """模型清单页 -> 对齐 ModelModel 字段的模型字典列表 (只取在售模型)"""
    rows = _table_rows(_section(markdown, ACTIVE_SECTION))
    if not rows:
        return []
    header = rows[0]
    name_column = _column(header, "模型名称")
    description_column = _column(header, "描述")
    if name_column is None:
        return []

    models: list[dict] = []
    for row in rows[1:]:
        # 表格里的模型名带反引号, 去掉才是 API 调用用的名字
        api_name = _cell(row, name_column).strip("`").strip()
        if not api_name:
            continue
        models.append(
            {
                "api_name": api_name,
                "company": COMPANY,
                "description": _cell(row, description_column) or None,
                # 分组的 h2 就是官网自己的模型分类, 前端按它分组展示
                "category": ACTIVE_SECTION,
            }
        )
    return models


def _column_titles(markdown: str) -> list[str]:
    """DocTable 的列名"""
    matched = COLUMNS_BLOCK.search(markdown)
    return COLUMN_TITLE.findall(matched.group(1)) if matched else []


def _doc_table_rows(markdown: str) -> list[list[str]]:
    """DocTable 的数据行 (JS 数组字面量, 逐行按 JSON 解析)"""
    matched = ROWS_BLOCK.search(markdown)
    if not matched:
        return []

    rows: list[list[str]] = []
    for row in ARRAY_ROW.finditer(matched.group(1)):
        try:
            cells = json.loads(f"[{row.group(1)}]")
        except json.JSONDecodeError:
            continue
        if isinstance(cells, list) and cells and all(
            isinstance(cell, str) for cell in cells
        ):
            rows.append(cells)
    return rows


def parse_pricing(markdown: str) -> dict[str, dict]:
    """定价页 -> {模型名: {价格字段, 上下文长度}}"""
    header = _column_titles(markdown)
    if not header:
        return {}

    name_column = _column(header, NAME_COLUMN)
    context_column = _column(header, CONTEXT_COLUMN)
    price_columns = {
        index: PRICE_COLUMNS[keyword]
        for keyword in PRICE_COLUMNS
        if (index := _column(header, keyword)) is not None
    }

    result: dict[str, dict] = {}
    for row in _doc_table_rows(markdown):
        api_name = _cell(row, name_column).strip("`").strip()
        if not api_name:
            continue
        entry: dict = {}
        for index, field in price_columns.items():
            value = _price(_cell(row, index))
            if value is not None:
                entry[field] = value
        context_tokens = _tokens(_cell(row, context_column))
        if context_tokens is not None:
            entry["context_tokens"] = context_tokens
        if entry:
            result[api_name] = entry
    return result


class KimiModelsCrawler(ModelsCrawlerBase):
    """月之暗面 Kimi 开放平台的模型清单与推理定价"""

    async def fetch_models(self, source: SourceModel) -> list[dict]:
        """抓模型清单页与定价页, 合并成对齐 ModelModel 字段的字典列表"""
        models = parse_models(await self._fetch_markdown(source, MODELS_PATH))
        if not models:
            raise CrawlerError(
                "模型清单页未解析到在售模型",
                source_name=source.name,
                url=f"{PLATFORM_BASE}{MODELS_PATH}",
            )

        pricing = parse_pricing(await self._fetch_markdown(source, PRICING_PATH))
        for model in models:
            model.update(pricing.get(model["api_name"], {}))
        return models

    async def _fetch_markdown(self, source: SourceModel, path: str) -> str:
        """抓文档页的纯 markdown 版本"""
        resp = await self._get(urljoin(PLATFORM_BASE, path), source)
        return resp.text
