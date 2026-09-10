import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { useNewsDetail } from "@/api/news"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionHeader, SectionMoreLink } from "@/components/home/hero"
import { formatDateTime, markdownToPlain } from "@/lib/format"
import type { NewsListItem } from "@/types/api"
import { cn } from "@/lib/utils"

/** 头条卡片: 标题 + 摘要(取正文前段) + 阅读全文 */
function FeaturedCard({ item }: { item: NewsListItem }) {
  const { data: detail } = useNewsDetail(item.id)
  const summary = markdownToPlain(detail?.content)

  return (
    <article className="group flex h-full flex-col rounded-xl border bg-card p-6 transition-shadow hover:shadow-md sm:p-8">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Badge variant="secondary" className="font-medium">
          {item.source_name}
        </Badge>
        <span className="tabular-nums">{formatDateTime(item.published_at)}</span>
      </div>

      <h3 className="mt-4 font-display text-2xl font-bold leading-snug tracking-tight">
        <Link
          to="/news/$id"
          params={{ id: String(item.id) }}
          className="transition-colors group-hover:text-primary"
        >
          {item.title}
        </Link>
      </h3>

      <p className="mt-4 line-clamp-5 flex-1 text-sm leading-relaxed text-muted-foreground">
        {detail
          ? (summary || "正文抓取中, 点击查看原文 ›")
          : "正在加载摘要…"}
      </p>

      <Link
        to="/news/$id"
        params={{ id: String(item.id) }}
        className="mt-6 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary"
      >
        阅读全文
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  )
}

function FeaturedSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 sm:p-8">
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="mt-4 h-8 w-full" />
      <Skeleton className="mt-2 h-8 w-3/4" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <Skeleton className="mt-6 h-5 w-20" />
    </div>
  )
}

function ListItem({ item, index }: { item: NewsListItem; index: number }) {
  return (
    <Link
      to="/news/$id"
      params={{ id: String(item.id) }}
      className="group flex gap-4 py-4 first:pt-0 last:pb-0"
    >
      <span className="font-display text-lg font-black leading-tight text-muted-foreground/35 tabular-nums">
        {String(index + 2).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 font-semibold leading-snug transition-colors group-hover:text-primary">
          {item.title}
        </h4>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatDateTime(item.published_at)}</span>
          <span aria-hidden>·</span>
          <span>来源: {item.source_name}</span>
        </div>
      </div>
    </Link>
  )
}

/** 今日要闻区: 左侧栏目序号 + 头条 + 要闻列表 */
export function NewsGrid({
  featured,
  rest,
  loading,
  className,
}: {
  featured?: NewsListItem
  rest: NewsListItem[]
  loading: boolean
  className?: string
}) {
  return (
    <section className={cn("container py-14 lg:py-16", className)}>
      <div className="grid gap-10 lg:grid-cols-[150px_minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* 左侧栏目序号 */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="font-display text-6xl font-black leading-none tracking-tight">01</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            / Today
          </div>
          <h2 className="mt-4 text-lg font-bold">今日要闻</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            来自全部数据源的最新抓取
          </p>
          <div className="mt-4 hidden lg:block">
            <SectionMoreLink to="/news" />
          </div>
        </aside>

        {/* 头条 */}
        <div>
          {loading ? (
            <FeaturedSkeleton />
          ) : featured ? (
            <FeaturedCard item={featured} />
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed bg-card/50 text-sm text-muted-foreground">
              暂无新闻数据
            </div>
          )}
        </div>

        {/* 要闻列表 */}
        <div className="flex flex-col">
          <SectionHeader
            eyebrow="Latest"
            title="最新资讯"
            className="lg:hidden"
            action={<SectionMoreLink to="/news" />}
          />
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-4">
                  <Skeleton className="h-6 w-7" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : rest.length > 0 ? (
            <div className="divide-y">
              {rest.map((item, i) => (
                <ListItem key={item.id} item={item} index={i} />
              ))}
            </div>
          ) : (
            !featured && (
              <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed bg-card/50 text-sm text-muted-foreground">
                暂无更多资讯
              </div>
            )
          )}
          <div className="mt-4 lg:hidden">
            <SectionMoreLink to="/news" />
          </div>
        </div>
      </div>
    </section>
  )
}
