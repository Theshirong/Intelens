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
