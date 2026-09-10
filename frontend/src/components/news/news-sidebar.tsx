import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useNewsList } from "@/api/news"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface NewsSidebarProps {
  activeId: number
  className?: string
  /** 点击条目后回调, 用于关闭窄屏抽屉 */
  onNavigate?: () => void
}

/**
 * 侧栏两个控件共用同一套边缘: 中性灰描边, 悬停/聚焦只加深描边,
 * 不引入主色蓝, 避免深浅不一的彩色光圈。
 */
const FIELD_BASE =
  "h-10 w-full rounded-lg border border-foreground/10 bg-secondary/70 shadow-none transition-colors hover:border-foreground/20 hover:bg-secondary"
const FIELD_FOCUS =
  "focus-visible:border-foreground/25 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
const SELECT_FOCUS = "focus:border-foreground/25 focus:ring-0 focus:ring-offset-0"

/** 新闻详情页左侧的资讯目录: 搜索 + 来源筛选 + 最新列表。 */
export function NewsSidebar({ activeId, className, onNavigate }: NewsSidebarProps) {
  const [query, setQuery] = useState("")
  const [sourceId, setSourceId] = useState<number | null>(null)

  const listQuery = useNewsList({ page: 1, pageSize: 50, sourceId })
  // 后端暂无来源列表接口, 复用一页大分页数据推导可选来源
  const sourcesQuery = useNewsList({ page: 1, pageSize: 100 })
  const sources = useMemo(
    () =>
      Array.from(
        new Map(
          (sourcesQuery.data?.items ?? []).map((item) => [
            item.source_id,
            item.source_name,
          ]),
        ).entries(),
      ),
    [sourcesQuery.data?.items],
  )

  const items = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    return (listQuery.data?.items ?? []).filter((item) =>
      keyword ? item.title.toLocaleLowerCase().includes(keyword) : true,
    )
  }, [listQuery.data?.items, query])

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索文档"
          aria-label="搜索文档"
          className={cn(FIELD_BASE, FIELD_FOCUS, "pl-9")}
        />
      </div>

      <Select
        value={sourceId === null ? "all" : String(sourceId)}
        onValueChange={(value) => setSourceId(value === "all" ? null : Number(value))}
      >
        <SelectTrigger
          aria-label="选择资讯来源"
          className={cn(FIELD_BASE, SELECT_FOCUS, "px-3")}
        >
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

      <div>
        <h2 className="px-1 text-sm font-bold text-foreground">最新</h2>
        <nav aria-label="最新资讯" className="mt-1.5 space-y-0.5">
          {listQuery.isPending ? (
            Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-md" />
            ))
          ) : items.length > 0 ? (
            items.map((item) => (
              <Link
                key={item.id}
                to="/news/$id"
                params={{ id: String(item.id) }}
                onClick={onNavigate}
                aria-current={item.id === activeId ? "page" : undefined}
                className={cn(
                  "block rounded-md px-2.5 py-1.5 text-[13px] leading-5 transition-colors hover:bg-secondary hover:text-foreground",
                  item.id === activeId
                    ? "bg-secondary font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <span className="line-clamp-2">{item.title}</span>
              </Link>
            ))
          ) : (
            <p className="px-2.5 py-4 text-sm text-muted-foreground">
              未找到相关资讯
            </p>
          )}
        </nav>
      </div>
    </div>
  )
}
