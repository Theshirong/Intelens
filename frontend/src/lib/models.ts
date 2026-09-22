import { formatPrice } from "@/lib/format"
import { vendorLabel } from "@/lib/vendors"
import type { ModelListItem } from "@/types/api"

export interface PriceSection {
  caption: string
  rows: { label: string; value: string }[]
  /** 计价规则备注 (峰谷时段、长上下文加价), 没有则空数组 */
  notes: string[]
}

/**
 * 计费区内容
 *
 * 有 token 单价就列「缓存命中 / 缓存未命中 / 输出」三行; 分时定价的型号
 * (如 DeepSeek 的峰谷价) 每一项显示「空闲 / 高峰」两个价。价格由后端从
 * OpenRouter 的 pricing.overrides 派生, 前端只负责展示。
 */
export function priceSection(model: ModelListItem): PriceSection {
  const tokenPrices = [
    model.price_input_hit_idle,
    model.price_input_miss_idle,
    model.price_output_idle,
  ]
  if (tokenPrices.some((price) => price != null)) {
    const hasPeak = [
      model.price_input_hit_peak,
      model.price_input_miss_peak,
      model.price_output_peak,
    ].some((price) => price != null)
    const priceText = (idle: number | null, peak: number | null) =>
      hasPeak ? `${formatPrice(idle)} / ${formatPrice(peak)}` : formatPrice(idle)
    return {
      caption: hasPeak
        ? "价格 (美元/百万 tokens，空闲 / 高峰)"
        : "价格 (美元/百万 tokens)",
      rows: [
        {
          label: "输入 · 缓存命中",
          value: priceText(model.price_input_hit_idle, model.price_input_hit_peak),
        },
        {
          label: "输入 · 缓存未命中",
          value: priceText(model.price_input_miss_idle, model.price_input_miss_peak),
        },
        {
          label: "输出",
          value: priceText(model.price_output_idle, model.price_output_peak),
        },
      ],
      notes: model.price_notes,
    }
  }
  return {
    caption: "计费",
    rows: [{ label: "单价", value: "Free" }],
    notes: model.price_notes,
  }
}

/** 展示名: OpenRouter 的 name 带厂商前缀 ("DeepSeek: DeepSeek V4.1 Flash"), 卡片副标题已写厂商, 这里剥掉 */
export function modelDisplayName(model: ModelListItem): string {
  return model.name?.replace(/^[^:]{1,32}:\s*/, "") ?? model.api_name
}

/** 上下文窗口: 自营渠道实际提供的窗口优先, 缺失时退回目录值 */
export function contextWindow(model: ModelListItem): number | null {
  return model.top_provider?.context_length ?? model.context_length
}

/** 最大输出 (自营渠道) */
export function maxOutput(model: ModelListItem): number | null {
  return model.top_provider?.max_completion_tokens ?? null
}

/** Artificial Analysis 的三个指数 (来自 OpenRouter 目录的 benchmarks) */
export function analysisIndices(model: ModelListItem) {
  const analysis = model.benchmarks?.artificial_analysis
  return {
    intelligence: analysis?.intelligence_index ?? null,
    coding: analysis?.coding_index ?? null,
    agentic: analysis?.agentic_index ?? null,
  }
}

/** 某厂商的全部模型 */
export function modelsOfVendor(
  models: ModelListItem[],
  company: string,
): ModelListItem[] {
  return models.filter((model) => model.company === company)
}

export { vendorLabel }
