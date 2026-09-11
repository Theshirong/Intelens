"""DeepSeek「模型 & 价格」页解析与抓取

页面: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
表格为「一列一个模型」的纵向表, 带 rowspan/colspan 合并单元格,
解析规则见 parse_pricing_table 的 docstring。
"""

import re

import lxml.etree

from app.crawlers.base import CrawlerError, ModelsCrawlerBase
from app.models.source_model import SourceModel

# 站方表格里混入的 U+FFFD 坏字符, 连同前后可能粘连的空格一起清理
BAD_CHARS = re.compile("[�]")

# "1M" / "384K" / "最大 384K" -> token 数
TOKEN_NUM = re.compile(r"(\d+(?:\.\d+)?)\s*([KMB])", re.IGNORECASE)

# 价格单元格如 "0.05元"
PRICE = re.compile(r"(\d+(?:\.\d+)?)\s*元")

# 功能单元格的三种取值 -> bool/None
SUPPORTED_TEXT = "支持"
NOT_SUPPORTED_TEXT = "不支持"
# "仅非思考模式支持" 这类限定语, 视为支持但保留原文到 description
PARTIAL_PREFIX = "仅"


def _clean(text: str) -> str:
    """合并空白、清理坏字符"""
    return BAD_CHARS.sub("", re.sub(r"\s+", " ", text).strip())


def _parse_tokens(text: str) -> int | None:
    """'1M' / '最大 384K' -> 1_000_000 / 393_216 之类的 token 数"""
    m = TOKEN_NUM.search(text)
    if m is None:
        return None
    num = float(m.group(1))
    unit = m.group(2).upper()
    multiplier = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}[unit]
    return int(num * multiplier)


def _parse_price(text: str) -> float | None:
    m = PRICE.search(text)
    return float(m.group(1)) if m else None


def _parse_support(text: str) -> bool | None:
    """'支持' -> True, '不支持' -> False, 限定语(如'仅非思考模式支持')或空 -> None"""
    clean = _clean(text)
    if clean == SUPPORTED_TEXT:
        return True
    if clean == NOT_SUPPORTED_TEXT:
        return False
    return None


def _flatten_table(table: lxml.etree._Element) -> list[list[str]]:
    """把带 rowspan/colspan 的表格展开成规整的二维文本矩阵

    逻辑: 先按 rowspan 给下方行占位, 再按 colspan 在行内复制单元格。
    展开后 table[r][c] 即第 r 行第 c 列的文本, 合并区域重复出现同一文本。
    """
    # grid[行][列] 暂存文本, 纵向合并的区域在其覆盖的下方行重复出现同一文本
    grid: list[dict[int, str]] = [{} for _ in table.xpath(".//tr")]

    for r, tr in enumerate(table.xpath(".//tr")):
        cells = tr.xpath("./th|./td")
        # 起始列: 跳过上方 rowspan 落下来的占位列
        col = 0
        while col in grid[r]:
            col += 1
        for cell in cells:
            text = _clean("".join(cell.itertext()))
            rowspan = int(cell.get("rowspan") or 1)
            colspan = int(cell.get("colspan") or 1)
            for i in range(colspan):
                grid[r][col + i] = text
            # rowspan 向下占位
            for j in range(1, rowspan):
                if r + j < len(grid):
                    grid[r + j][col] = text
            col += colspan

    # 序列化成矩阵, 列数取最大值, 缺失补空串
    width = max((max(row.keys()) + 1 if row else 0) for row in grid) if grid else 0
    return [
        [row.get(c, "") for c in range(width)] for row in grid
    ]


# 行标签 -> (取值列偏移, 解析函数)。
# 展开后矩阵前 3 列是行标签区, 模型数据从第 4 列开始 (LABEL_COLS)。
# 取值方式: 简单行直接取 [r][LABEL_COLS + i], 价格二级行按 (标签, 时段) 组合查找。
LABEL_COLS = 3

SIMPLE_ROW_PARSERS = {
    "模型版本": lambda v: v,
    "上下文长度": _parse_tokens,
    "输出长度": _parse_tokens,
    "思考模式": lambda v: v,
    "并发限制": lambda v: int(v) if v.isdigit() else None,
}

# 功能区行标签 -> models 表布尔字段
SUPPORT_ROW_FIELDS = {
    "Json Output": "support_json_output",
    "Tool Calls": "support_tool_calls",
    "Responses API": "support_responses_api",
    "Anthropic API": "support_anthropic_api",
    "对话前缀续写（Beta）": "support_prefix_completion",
    "FIM 补全（Beta）": "support_fim",
}


def parse_pricing_table(table: lxml.etree._Element) -> list[dict]:
    """解析展开后的价格表为模型字典列表

    返回如 [{'api_name': 'deepseek-v4-flash', 'context_tokens': 1000000, ...}]。
    页面结构变化 (找不到模型行) 时抛 CrawlerError。
    """
    matrix = _flatten_table(table)

    # 模型名行: 第一列标签为「模型」, 后续列即 api_name 列表
    try:
        header_row = next(r for r in matrix if r[0] == "模型")
    except StopIteration:
        raise CrawlerError("价格表未找到「模型」表头行") from None
    api_names = [c for c in header_row[LABEL_COLS:] if c]
    if not api_names:
        raise CrawlerError("价格表「模型」行未解析到模型名") from None

    models: list[dict] = [
        {"api_name": name, "company": "deepseek"} for name in api_names
    ]

    for row in matrix:
        label = row[0]
        # 全模型共用的行 (colspan 展开后标签复制了 3 份), 取第一个非空值
        if label in ("BASE URL (OpenAI 格式)", "BASE URL (Anthropic 格式)"):
            value = next((c for c in row[LABEL_COLS:] if c), None)
            field = (
                "base_url_openai"
                if "OpenAI" in label
                else "base_url_anthropic"
            )
            for m in models:
                m[field] = value
        elif label in SIMPLE_ROW_PARSERS:
            parser = SIMPLE_ROW_PARSERS[label]
            field = {
                "模型版本": "version",
                "上下文长度": "context_tokens",
                "输出长度": "max_output_tokens",
                "思考模式": "thinking_mode",
                "并发限制": "concurrency_limit",
            }[label]
            for i, m in enumerate(models):
                m[field] = parser(row[LABEL_COLS + i])
        elif label in SUPPORT_ROW_FIELDS or row[1] in SUPPORT_ROW_FIELDS:
            # 功能区行标签在第二列 (第一列是 rowspan 传播下来的「功能」)
            field = SUPPORT_ROW_FIELDS[row[1]]
            for i, m in enumerate(models):
                m[field] = _parse_support(row[LABEL_COLS + i])
        elif label.startswith("价格"):
            # 价格二级行: row[1] 是计费项, row[2] 是时段
            _parse_price_row(row, models)

    return models


def _parse_price_row(row: list[str], models: list[dict]) -> None:
    """处理展开后的价格行, 按 (计费项, 时段) 映射到价格字段"""
    billing = row[1]
    period = row[2]

    field_map = {
        ("百万tokens输入（缓存命中）", "空闲时段"): "price_input_hit_idle",
        ("百万tokens输入（缓存命中）", "高峰时段"): "price_input_hit_peak",
        ("百万tokens输入（缓存未命中）", "空闲时段"): "price_input_miss_idle",
        ("百万tokens输入（缓存未命中）", "高峰时段"): "price_input_miss_peak",
        ("百万tokens输出", "空闲时段"): "price_output_idle",
        ("百万tokens输出", "高峰时段"): "price_output_peak",
    }
    field = field_map.get((billing, period))
    if field is None:
        return
    for i, m in enumerate(models):
        m[field] = _parse_price(row[LABEL_COLS + i])


class DsModelsCrawler(ModelsCrawlerBase):
    """DeepSeek 官网「模型 & 价格」页, 产出结构化模型信息"""

    PRICING_PATH = "/zh-cn/quick_start/pricing"

    async def fetch_models(self, source: SourceModel) -> list[dict]:
        """抓取并解析价格页, 返回模型字典列表 (对齐 ModelModel 字段)"""
        from urllib.parse import urljoin

        resp = await self._get(urljoin(source.url, self.PRICING_PATH), source)
        et = lxml.etree.HTML(resp.text)
        tables = et.xpath("//div[contains(@class,'theme-doc-markdown')]//table")
        if not tables:
            raise CrawlerError(
                "价格页未找到模型表格", source_name=source.name, url=str(resp.url)
            )
        # 第一张表即「模型细节」表
        return parse_pricing_table(tables[0])
