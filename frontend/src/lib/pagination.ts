/** 生成带省略号的页码窗口: 1 … 3 4 5 … 12 */
export function pageWindow(
  current: number,
  total: number,
): Array<number | "ellipsis-l" | "ellipsis-r"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: Array<number | "ellipsis-l" | "ellipsis-r"> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push("ellipsis-l")
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push("ellipsis-r")
  pages.push(total)
  return pages
}
