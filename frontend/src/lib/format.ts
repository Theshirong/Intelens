import { format } from "date-fns"

/** "MM-dd HH:mm" — 列表与卡片用 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "MM-dd HH:mm")
}

/** "yyyy-MM-dd" — 详情页与表格用 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "yyyy-MM-dd")
}

/** "yyyy-MM-dd HH:mm" */
export function formatFullDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "yyyy-MM-dd HH:mm")
}

/** 粗略剥掉 markdown 标记, 用于摘要预览 */
export function markdownToPlain(md: string | null | undefined): string {
  if (!md) return ""
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** 去掉无意义的小数位: 1.0 -> "1", 1.5 -> "1.5" */
function trimDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** token 数 -> 紧凑显示: 1000000 -> "1M", 128000 -> "128K" */
export function formatTokens(tokens: number | null | undefined): string {
  if (tokens === null || tokens === undefined) return "—"
  if (tokens >= 1_000_000) return `${trimDecimal(tokens / 1_000_000)}M`
  if (tokens >= 1_000) return `${trimDecimal(tokens / 1_000)}K`
  return String(tokens)
}

/**
 * 价格 (美元/百万 tokens) -> "$1.98"; 缺失时返回占位符
 *
 * 缓存命中的单价能低到千分之几美元, 固定小数位会把 0.0021 显示成 0.00,
 * 所以按有效数字修剪: 保留 4 位有效数字, 末尾的零交给 Number 去掉。
 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return "—"
  return `$${Number(price.toPrecision(4))}`
}
