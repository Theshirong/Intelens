import { Link } from "@tanstack/react-router"
import type { LinkProps } from "@tanstack/react-router"
import { ArrowUpRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface HeroProps {
  total?: number
  sourceCount?: number
  loading: boolean
}

const CATEGORY_PILLS = [
  { label: "全球AI资讯", to: "/news", hash: undefined },
  { label: "模型动态", to: "/", hash: "model-watch" },
  { label: "行业研究", to: "/", hash: "insight" },
  { label: "数据洞察", to: "/", hash: "trend-map" },
] as const

/** 首页刊头: 大字标题 + 副标语 + 分类入口 + 实时统计 */
export function Hero({ total, sourceCount, loading }: HeroProps) {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="container relative grid gap-10 py-14 lg:grid-cols-[1fr_auto] lg:py-20">
        {/* 左侧主标题 */}
        <div className="max-w-2xl">
          <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
            <span className="size-2 rounded-[2px] bg-primary" />
            Nexus AI News
          </p>
          <h1 className="font-display text-6xl font-black leading-[0.95] sm:text-7xl lg:text-8xl">
            AI NEWS
            <br />
            <span className="text-outline">INTELLIGENCE</span>
          </h1>
          <p className="mt-6 max-w-md text-base text-muted-foreground sm:text-lg">
            从海量信息中，发现真正重要的 AI 动向。
          </p>

          {/* 分类入口 */}
          <div className="mt-8 flex flex-wrap gap-2.5">
            {CATEGORY_PILLS.map((pill) => (
              <Link
                key={pill.label}
                to={pill.to}
                hash={pill.hash}
                className="rounded-full border bg-white px-4 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                {pill.label}
              </Link>
            ))}
          </div>

          {/* 实时统计 */}
          <dl className="mt-10 flex gap-10">
            <div>
              <dt className="text-xs text-muted-foreground">实时资讯</dt>
              <dd className="font-display text-3xl font-black tabular-nums">
                {loading ? <Skeleton className="mt-1 h-9 w-16" /> : (total ?? 0).toLocaleString()}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">篇</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">数据源</dt>
              <dd className="font-display text-3xl font-black tabular-nums">
                {loading ? <Skeleton className="mt-1 h-9 w-10" /> : sourceCount ?? 0}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">个</span>
              </dd>
            </div>
          </dl>
        </div>

        {/* 右侧装饰排版 + 竖排标语 */}
        <div className="relative hidden items-end justify-end gap-8 lg:flex">
          <div className="select-none text-right font-display leading-[0.85]">
            <div className="text-outline text-8xl font-black">AI</div>
            <div className="text-8xl font-black">NEWS</div>
            <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.45em] text-muted-foreground">
              Industry Monitor
            </div>
          </div>
          <div
            aria-hidden
            className="h-64 origin-bottom rotate-180 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.4em] text-muted-foreground/60 [writing-mode:vertical-rl]"
          >
            Better Information · Bigger Perspective
          </div>
        </div>
      </div>

      {/* 底部装饰细线 */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/30" />
    </section>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow: string
  title: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-4", className)}>
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
          {eyebrow}
        </div>
        <h2 className="mt-1 font-display text-xl font-black tracking-tight sm:text-2xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}

export function SectionMoreLink({
  to,
  hash,
  label = "查看全部",
}: {
  to: LinkProps["to"]
  hash?: LinkProps["hash"]
  label?: string
}) {
  return (
    <Link
      to={to}
      hash={hash}
      className="group flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
    >
      {label}
      <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  )
}
