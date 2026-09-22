/**
 * 厂商标识 -> 展示名
 *
 * 模型接口用 `company`、新闻接口用 `source_name`, 两边取的是同一套标识
 * (deepseek / mimo / zhipu), 所以映射只留一份, 免得改一处漏一处。
 * 未收录的直接显示原始值。
 */
const VENDOR_LABELS: Record<string, string> = {
  deepseek: "DeepSeek",
  kimi: "Kimi",
  mimo: "MiMo",
  zhipu: "GLM",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  meta: "Meta",
  qwen: "Qwen",
  tencent: "Tencent",
}

export function vendorLabel(vendor: string): string {
  return VENDOR_LABELS[vendor] ?? vendor
}

/**
 * 厂商标识 -> 产地
 *
 * 散点图用「颜色区分厂商、形状区分产地」两层编码, 这里只维护产地这一层。
 * 未收录的厂商归到 other (画成菱形)。
 */
const VENDOR_REGIONS: Record<string, string> = {
  deepseek: "CN",
  kimi: "CN",
  mimo: "CN",
  zhipu: "CN",
  qwen: "CN",
  tencent: "CN",
  openai: "US",
  anthropic: "US",
  google: "US",
  meta: "US",
}

export function vendorRegion(vendor: string): string {
  return VENDOR_REGIONS[vendor] ?? "other"
}
