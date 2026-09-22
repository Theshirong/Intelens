import { Link, createFileRoute } from "@tanstack/react-router"
import { ChevronLeft, Inbox } from "lucide-react"
import { useModelList, usePriceHistory } from "@/api/models"
import { PriceHistoryChart } from "@/components/models/price-charts"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatTokens } from "@/lib/format"
import {
  analysisIndices,
  contextWindow,
  maxOutput,
  modelDisplayName,
  priceSection,
  vendorLabel,
} from "@/lib/models"
import type { ModelListItem } from "@/types/api"

export const Route = createFileRoute("/_app/models/$company/$modelId")({
  component: ModelDetailPage,
})

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

/** 当前计费与规格 */
function ModelSpecCard({ model }: { model: ModelListItem }) {
  const pricing = priceSection(model)
  const indices = analysisIndices(model)

  return (
    <Card className="p-5">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <dl className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            {pricing.caption}
          </div>
          {pricing.rows.map((row) => (
            <SpecRow key={row.label} label={row.label} value={row.value} />
          ))}
        </dl>
        <dl className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">规格</div>
          <SpecRow
            label="上下文窗口"
            value={formatTokens(contextWindow(model))}
          />
          <SpecRow
            label="最大输出"
            value={formatTokens(maxOutput(model))}
          />
        </dl>
        <dl className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Artificial Analysis
          </div>
          <SpecRow
            label="智能指数"
            value={indices.intelligence?.toFixed(1) ?? "—"}
          />
          <SpecRow label="编程指数" value={indices.coding?.toFixed(1) ?? "—"} />
          <SpecRow label="Agent 指数" value={indices.agentic?.toFixed(1) ?? "—"} />
        </dl>
      </div>
      {pricing.notes.length > 0 && (
        <div className="mt-5 space-y-1 border-t pt-4">
          {pricing.notes.map((note) => (
            <p key={note} className="text-xs leading-relaxed text-muted-foreground">
              {note}
            </p>
          ))}
        </div>
      )}
    </Card>
  )
}

/** 模型详情: 当前计费 + 价格时间轴 */
function ModelDetailPage() {
  const { company, modelId } = Route.useParams()
  const id = Number(modelId)
  const { data, isPending, isError } = useModelList()
  const history = usePriceHistory(id)

  const model = (data ?? []).find((item) => item.id === id)
  const points = history.data ?? []
  // 三个价格字段全空时画不出曲线 (免费型号是 0 而不是空, 仍能画)
  const hasTokenPrice = points.some(
    (point) =>
      point.price_input_hit_idle != null ||
      point.price_input_miss_idle != null ||
      point.price_output_idle != null,
  )

  return (
    <div className="container max-w-5xl py-10">
      <Link
        to="/models/$company"
        params={{ company }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronLeft className="size-4" />
        返回 {vendorLabel(company)}
      </Link>

      {isPending ? (
        <Skeleton className="mt-8 h-9 w-72" />
      ) : isError || !model ? (
        <div className="mt-8 flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Inbox className="size-8" />
          <p className="text-sm">未找到该模型</p>
        </div>
      ) : (
        <>
          <header className="mt-6">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
              {vendorLabel(model.company)}
            </div>
            <h1 className="mt-1 font-display text-2xl font-black tracking-tight sm:text-3xl">
              {modelDisplayName(model)}
            </h1>
          </header>

          <div className="mt-8 space-y-6">
            <ModelSpecCard model={model} />

            <Card className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-bold">价格走势</h2>
                <span className="text-xs text-muted-foreground">
                  美元 / 百万 tokens
                </span>
              </div>
              <div className="mt-4">
                {history.isPending ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : history.isError ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    价格历史加载失败
                  </p>
                ) : !hasTokenPrice ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    该模型没有可比的 token 单价，画不出价格曲线
                  </p>
                ) : (
                  <PriceHistoryChart data={points} />
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
