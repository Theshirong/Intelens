"""OpenRouter 定价解析: 计费项单价 -> 空闲/高峰价与中文说明

OpenRouter 一个模型的 ``pricing`` (美元/token 的字符串) 里有两层信息, 都在
``overrides`` 里给出:

1. **时段价(峰谷)** —— 带 ``utc_start`` / ``utc_end`` / ``utc_days`` 的条目给出
   各时段单价, 方向不固定 (DeepSeek 是工作日高峰翻倍, 腾讯 hy3 是深夜打折),
   所以取最小当空闲、最大当高峰;
2. **长上下文档位价** —— 带 ``min_prompt_tokens`` 的条目是提示变长后的加价,
   与时段无关, 没有对应字段, 写成中文备注。

这里只放纯函数, 两头都用: 采集侧 (app/crawlers/openrouter_models.py) 拿它写
``price_history`` 快照, 服务层 (app/services/model_service.py) 拿它在响应里拼出
空闲/高峰价与备注 —— 价格是原样存进 models.pricing 的, 派生值不落库。
"""

# 计费项 -> models 侧 (空闲字段名, 高峰字段名)
BILLING_FIELDS = {
    "prompt": ("price_input_miss_idle", "price_input_miss_peak"),
    "input_cache_read": ("price_input_hit_idle", "price_input_hit_peak"),
    "completion": ("price_output_idle", "price_output_peak"),
}

WEEKDAY_DAYS = {"monday", "tuesday", "wednesday", "thursday", "friday"}
WEEKEND_DAYS = {"saturday", "sunday"}


def _usd_per_million(price: str | float | None) -> float | None:
    """OpenRouter 的「美元/token」-> models 侧的「美元/百万 tokens」"""
    if price is None or price == "":
        return None
    try:
        value = float(price)
    except (TypeError, ValueError):
        return None
    # 免费模型的 "0" 是合法价格, 只有负值才当异常
    if value < 0:
        return None
    return round(value * 1_000_000, 4)


def _format_tokens(tokens: int) -> str:
    """token 数 -> "272K" / "1M", 写进备注用"""
    if tokens >= 1_000_000:
        return f"{tokens / 1_000_000:g}M"
    if tokens >= 1_000:
        return f"{tokens / 1_000:g}K"
    return str(tokens)


def _time_windows(pricing: dict) -> list[dict]:
    """取时段价, 即 overrides 里带 utc_* 的条目

    overrides 有两种, 含义完全不同, 不能一锅端: 带 utc_start/utc_end/utc_days
    的是按时段的峰谷价; 带 min_prompt_tokens 的是长上下文档位价, 与时间无关。
    """
    return [
        override
        for override in (pricing.get("overrides") or [])
        if "utc_start" in override
    ]


def _utc_to_beijing(stamp: int) -> str:
    """OpenRouter 的 H*100+M 编码 UTC 时刻 -> 北京时间 "HH:MM" """
    hours, minutes = divmod(stamp, 100)
    total = (hours * 60 + minutes + 8 * 60) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def price_fields(pricing: dict | None) -> dict[str, float]:
    """定价 -> 峰谷字段 (美元/百万 tokens)

    基准价只是「默认时段」的价, 峰谷在 overrides 的时段里, 而且方向不固定:
    DeepSeek 是工作日高峰翻倍, 腾讯 hy3 是深夜打折。所以按计费项把基准价和
    各时段价放一起取最小当空闲、最大当高峰 —— 只有一个价时高峰留空,
    前端据此判断该型号有没有峰谷。
    """
    pricing = pricing or {}
    windows = _time_windows(pricing)
    fields: dict[str, float] = {}
    for billing, (idle_field, peak_field) in BILLING_FIELDS.items():
        candidates = [_usd_per_million(pricing.get(billing))]
        candidates += [_usd_per_million(window.get(billing)) for window in windows]
        values = sorted(value for value in candidates if value is not None)
        if not values:
            continue
        fields[idle_field] = values[0]
        if values[-1] > values[0]:
            fields[peak_field] = values[-1]
    return fields


def _peak_note(pricing: dict) -> str | None:
    """时段价 -> 中文说明, 如「高峰 工作日 09:00–12:00、14:00–18:00 ×2」"""
    base = _usd_per_million(pricing.get("prompt"))
    if base is None:
        return None

    spans: dict[tuple[str, float], list[str]] = {}
    for window in _time_windows(pricing):
        price = _usd_per_million(window.get("prompt"))
        if price is None or price == base:
            continue
        days = set(window.get("utc_days") or [])
        # 不写 utc_days 表示每天; 注意别用子集判断, 空集合是任何集合的子集
        if not days:
            day_text = "每天"
        elif days == WEEKDAY_DAYS:
            day_text = "工作日"
        elif days <= WEEKEND_DAYS:
            day_text = "周末"
        else:
            day_text = "部分日期"
        span = f"{day_text} {_utc_to_beijing(window['utc_start'])}–{_utc_to_beijing(window['utc_end'])}"
        label = "高峰" if price > base else "优惠"
        spans.setdefault((label, round(price / base, 2)), []).append(span)
    if not spans:
        return None

    parts = [
        f"{label}（北京时间, 单价 ×{ratio:g}）{'、'.join(items)}"
        for (label, ratio), items in sorted(spans.items(), key=lambda kv: -kv[0][1])
    ]
    return "；".join(parts)


def _context_tier_note(pricing: dict) -> str | None:
    """长上下文档位价 -> 中文说明 (提示变长后单价上浮)"""
    tiers = [
        override
        for override in (pricing.get("overrides") or [])
        if "min_prompt_tokens" in override
    ]
    parts = []
    for tier in sorted(tiers, key=lambda item: item["min_prompt_tokens"]):
        prompt = _usd_per_million(tier.get("prompt"))
        completion = _usd_per_million(tier.get("completion"))
        if prompt is None and completion is None:
            continue
        text = f"超 {_format_tokens(tier['min_prompt_tokens'])} 后"
        if prompt is not None:
            text += f" 输入 ${prompt}"
        if completion is not None:
            text += f"、输出 ${completion}"
        parts.append(text)
    if not parts:
        return None
    return "长上下文档位（美元/百万 tokens）：" + "；".join(parts)


def price_notes(pricing: dict | None) -> list[str]:
    """定价里的计价规则说明 (峰谷时段、长上下文加价), 每项一条"""
    pricing = pricing or {}
    return [
        note
        for note in (_peak_note(pricing), _context_tier_note(pricing))
        if note
    ]
