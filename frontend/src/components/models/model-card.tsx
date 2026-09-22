import { ArrowUpRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatTokens } from "@/lib/format"
import {
  contextWindow,
  maxOutput,
  modelDisplayName,
  priceSection,
  vendorLabel,
} from "@/lib/models"
import type { ModelListItem } from "@/types/api"

/**
 * 模型卡片
 *
 * 只展示各厂都有的可比字段: 计费、上下文窗口、最大输出。
 * 卡片整体是链接时用 hint 说明点进去能看到什么。
 */
export function ModelCard({
  model,
  hint,
}: {
  model: ModelListItem
  hint?: string
}) {
  const modelName = modelDisplayName(model)
  const pricing = priceSection(model)

  return (
    <article className="group flex h-full flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="min-w-0">
        <h3
          className="truncate font-display text-lg font-bold tracking-tight transition-colors group-hover:text-primary"
          title={model.api_name}
        >
          {modelName}
        </h3>
        <div className="truncate text-xs text-muted-foreground">
          {vendorLabel(model.company)}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-xs text-muted-foreground">{pricing.caption}</div>
        <dl className="mt-2 space-y-1.5">
          {pricing.rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-display font-bold tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* flex-1 让计费行数不同的卡片底部对齐 */}
      <dl className="mt-4 flex-1 space-y-1.5 border-t pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-muted-foreground">上下文窗口</dt>
          <dd className="text-sm font-medium tabular-nums">
            {formatTokens(contextWindow(model))}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-muted-foreground">最大输出</dt>
          <dd className="text-sm font-medium tabular-nums">
            {formatTokens(maxOutput(model))}
          </dd>
        </div>
      </dl>

      {hint && (
        <div className="mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
          {hint}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      )}
    </article>
  )
}

export function ModelCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5" aria-hidden>
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-2 h-3 w-16" />
      <Skeleton className="mt-5 h-3 w-24" />
      <div className="mt-2 space-y-1.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
      <div className="mt-4 space-y-1.5 border-t pt-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
    </div>
  )
}
