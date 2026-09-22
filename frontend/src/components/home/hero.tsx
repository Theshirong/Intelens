import { Link } from "@tanstack/react-router"
import type { LinkProps } from "@tanstack/react-router"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { HeroFace } from "@/components/home/hero-face"
import { HeroWeb } from "@/components/home/hero-web"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/stores/auth"
import { cn } from "@/lib/utils"

interface HeroProps {
  total?: number
  sourceCount?: number
  loading: boolean
}

type HeroAction =
  | {
      label: string
      primary: boolean
      to: LinkProps["to"]
      hash?: LinkProps["hash"]
      onClick?: undefined
    }
  | { label: string; primary: boolean; onClick: () => void }

/** 首页刊头: 问候语 + 标语 + 主入口 + 实时统计 */
export function Hero({ total, sourceCount, loading }: HeroProps) {
  const authed = Boolean(useAuthStore((s) => s.accessToken))

  // 主入口样式参考 mimo.mi.com 的胶囊按钮;
  // 未登录时第一颗按钮给登录入口, 登录后换成论坛 (账户设置挪到右上角头像菜单里)
  const actions: HeroAction[] = [
    authed
      ? { label: "博客论坛", to: "/forum", primary: true }
      : { label: "登录 / 注册", to: "/login", primary: true },
    { label: "最新资讯", to: "/news", primary: false },
    { label: "数据洞察", to: "/", hash: "trend-map", primary: false },
  ]

  return (
    <section className="relative overflow-hidden border-b">
      <div className="mx-auto grid w-full max-w-[1260px] items-center gap-10 px-6 py-20 sm:px-8 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,52%)] lg:gap-12 lg:px-10">
        <div className="flex flex-col items-start">
          <h1 className="font-kai flex items-center gap-3 text-[32px] font-medium leading-[1.4] tracking-tight sm:text-[36px] lg:text-[48px] lg:leading-[60px]">
            你好, 我是Yellow
            <HeroFace />
          </h1>
          {/* text-balance: 换行时两行长度均衡, 不会只剩一个字掉到第二行 */}
          <p className="font-kai mt-2 text-balance text-[32px] font-medium leading-[1.4] tracking-tight sm:text-[36px] lg:text-[48px] lg:leading-[60px]">
            与你同行，看看AI的世界
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            {actions.map((action) => {
              const className = cn(
                "group inline-flex h-9 min-w-[160px] items-center justify-center gap-2 rounded-md border px-4 text-sm transition-all",
                action.primary
                  ? "border-foreground bg-foreground text-background hover:opacity-90"
                  : "border-foreground/25 hover:border-foreground/60 hover:bg-secondary",
              )
              return action.onClick ? (
                <button key={action.label} type="button" onClick={action.onClick} className={className}>
                  {action.label}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <Link key={action.label} to={action.to} hash={action.hash} className={className}>
                  {action.label}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )
            })}
          </div>

          <dl className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <div className="flex items-baseline gap-1.5">
              <dt>实时资讯</dt>
              <dd className="font-display text-xl font-black tabular-nums text-foreground">
                {loading ? (
                  <Skeleton className="inline-block h-5 w-8 align-middle" />
                ) : (
                  (total ?? 0).toLocaleString()
                )}
              </dd>
              <span>篇</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt>数据源</dt>
              <dd className="font-display text-xl font-black tabular-nums text-foreground">
                {loading ? (
                  <Skeleton className="inline-block h-5 w-5 align-middle" />
                ) : (
                  (sourceCount ?? 0)
                )}
              </dd>
              <span>个</span>
            </div>
          </dl>
        </div>

        {/* 节点蛛网: 桌面跟随内容区缩放, 窄屏改为可左右滑动, 保证文字看得清 */}
        <div
          aria-hidden
          className="-mx-6 overflow-x-auto px-6 text-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-8 sm:px-8 lg:mx-0 lg:overflow-visible lg:px-0"
        >
          <div className="min-w-[560px] lg:min-w-0">
            <HeroWeb />
          </div>
        </div>
      </div>
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
