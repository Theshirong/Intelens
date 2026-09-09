import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronRight, Inbox } from "lucide-react"
import { useNewsList } from "@/api/news"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { SectionHeader } from "@/components/home/hero"
import { formatDateTime } from "@/lib/format"

interface NewsSearch {
  page?: number
  size?: number
  source?: number
}

export const Route = createFileRoute("/_app/news/")({
  validateSearch: (search: Record<string, unknown>): NewsSearch => {
    const page = Math.max(1, Number(search.page) || 1)
    const size = [10, 20, 50].includes(Number(search.size)) ? Number(search.size) : 20
    const source = Number(search.source) || undefined
    return { page, size, source }
  },
  component: NewsListPage,
})

/** 生成带省略号的页码窗口 */
function pageWindow(current: number, total: number): Array<number | "ellipsis-l" | "ellipsis-r"> {
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

function NewsListPage() {
  const navigate = useNavigate({ from: "/news" })
  const page = Route.useSearch().page ?? 1
  const size = Route.useSearch().size ?? 20
  const source = Route.useSearch().source

  // 列表 (按 URL 查询参数请求)
  const listQuery = useNewsList({ page, pageSize: size, sourceId: source ?? null })
  // 全量拉一页大分页, 用于来源筛选下拉 (后端暂无来源列表接口)
  const sourcesQuery = useNewsList({ page: 1, pageSize: 100 })
  const sources = Array.from(
    new Map(
      (sourcesQuery.data?.items ?? []).map((item) => [item.source_id, item.source_name]),
    ).entries(),
  )

  const data = listQuery.data
  const totalPages = data?.pages ?? 0

  const updateSearch = (next: Partial<NewsSearch>) => {
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, ...next }),
    })
  }

  return (
    <div className="container py-10 lg:py-12">
      <SectionHeader
        eyebrow="News Feed"
        title="最新资讯"
        action={
          data ? (
            <Badge variant="secondary" className="tabular-nums">
              共 {data.total} 条
            </Badge>
          ) : undefined
        }
      />

      {/* 筛选工具栏 */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select
          value={source ? String(source) : "all"}
          onValueChange={(value) =>
            updateSearch({ source: value === "all" ? undefined : Number(value), page: 1 })
          }
        >
          <SelectTrigger className="w-40 bg-white">
            <SelectValue placeholder="全部来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            {sources.map(([id, name]) => (
              <SelectItem key={id} value={String(id)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(size)}
          onValueChange={(value) => updateSearch({ size: Number(value), page: 1 })}
        >
          <SelectTrigger className="w-28 bg-white" aria-label="每页条数">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} 条/页
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {data && (
          <span className="text-xs text-muted-foreground tabular-nums">
            第 {data.page} / {Math.max(data.pages, 1)} 页
          </span>
        )}
      </div>

      {/* 新闻列表 */}
      <Card className="overflow-hidden p-0">
        {listQuery.isPending ? (
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-5">
                <Skeleton className="h-6 w-7" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="divide-y">
            {data.items.map((item, index) => (
              <a
                key={item.id}
                href={`/news/${item.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  void navigate({ to: "/news/$id", params: { id: String(item.id) } })
                }}
                className="group flex items-center gap-4 p-5 transition-colors hover:bg-accent/60"
              >
                <span className="hidden w-8 shrink-0 font-display text-lg font-black text-muted-foreground/35 tabular-nums sm:block">
                  {String((data.page - 1) * data.page_size + index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 font-semibold transition-colors group-hover:text-primary">
                    {item.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="h-5 px-2 text-xs font-medium">
                      {item.source_name}
                    </Badge>
                    <span className="tabular-nums">{formatDateTime(item.published_at)}</span>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </a>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Inbox className="size-8" />
            <p className="text-sm">暂无符合条件的资讯</p>
          </div>
        )}
      </Card>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-disabled={page <= 1}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                  onClick={(e) => {
                    e.preventDefault()
                    if (page > 1) updateSearch({ page: page - 1 })
                  }}
                />
              </PaginationItem>
              {pageWindow(page, totalPages).map((p, i) =>
                typeof p === "number" ? (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={p === page}
                      onClick={(e) => {
                        e.preventDefault()
                        updateSearch({ page: p })
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ) : (
                  <PaginationItem key={i}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-disabled={page >= totalPages}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                  onClick={(e) => {
                    e.preventDefault()
                    if (page < totalPages) updateSearch({ page: page + 1 })
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
