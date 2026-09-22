import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { modelDisplayName } from "@/lib/models"
import type { ModelListItem, PriceHistoryItem } from "@/types/api"

/**
 * 三项单价的配色: 由浅到深的蓝, 与设计稿一致。
 * 不用主题里的 --chart-N, 那套是给多主题系列用的, 这里需要同色系递进。
 */
const PRICE_COLORS = {
  hit: "#a9d5f0",
  miss: "#5fa8e0",
  output: "#1673cf",
} as const

/** 三项单价, 顺序即展示顺序 (由便宜到贵) */
const PRICE_ROWS = [
  { key: "price_input_hit_idle", label: "输入（命中缓存）", color: PRICE_COLORS.hit },
  { key: "price_input_miss_idle", label: "输入（未命中缓存）", color: PRICE_COLORS.miss },
  { key: "price_output_idle", label: "输出", color: PRICE_COLORS.output },
] as const

/** 折线图的系列配置, 口径与卡片上的三行价格一致 (单位: 美元/百万 tokens) */
const SERIES = PRICE_ROWS.map((row) => ({
  key: row.key,
  label: row.label,
  color: row.color,
}))

const chartConfig = {
  price_input_hit_idle: { label: "输入（命中缓存）", color: PRICE_COLORS.hit },
  price_input_miss_idle: { label: "输入（未命中缓存）", color: PRICE_COLORS.miss },
  price_output_idle: { label: "输出", color: PRICE_COLORS.output },
} satisfies ChartConfig

/** "2026-09-15" -> "09-15" */
function shortDate(day: string): string {
  return day.slice(5)
}

function PriceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="mb-1.5 text-xs font-semibold tabular-nums">{label}</div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-0.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-semibold tabular-nums">
              {entry.value ?? "—"}
            </span>
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 图例: 与折线图共用同一套系列色 */
function PriceLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
      {SERIES.map((series) => (
        <div
          key={series.key}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            aria-hidden
            className="h-0.5 w-3.5 rounded-full"
            style={{ backgroundColor: series.color }}
          />
          {series.label}
        </div>
      ))}
    </div>
  )
}

/** 折线图: 单个模型的价格随时间变化 */
export function PriceHistoryChart({ data }: { data: PriceHistoryItem[] }) {
  // 数据点太少时折线几乎看不见, 补上圆点; 点多起来再收起, 免得糊成一片
  const showDots = data.length <= 15

  return (
    <div className="space-y-4">
      <PriceLegend />

      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />
          <XAxis
            dataKey="captured_on"
            tickFormatter={shortDate}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickMargin={10}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            width={44}
            axisLine={false}
            tickLine={false}
            tick={{
              fontSize: 12,
              fill: "hsl(var(--muted-foreground))",
              style: { fontVariantNumeric: "tabular-nums" },
            }}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            content={<PriceTooltip />}
          />
          {SERIES.map((series) => (
            <Line
              key={series.key}
              dataKey={series.key}
              name={series.label}
              type="monotone"
              stroke={series.color}
              strokeWidth={2}
              strokeLinecap="round"
              dot={
                showDots ? { r: 3, strokeWidth: 0, fill: series.color } : false
              }
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: "hsl(var(--card))",
                fill: series.color,
              }}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  )
}

/**
 * 各模型单价对比
 *
 * 三项单价能差两三个数量级 (0.02 vs 6), 所以不能共用一根刻度:
 * 线性共用 → 小的那项被压成一条线; 对数共用 → 柱长失真。
 * 这里按价格项拆成三组, 每组用自己的线性刻度 (柱长 = 该项 / 该项最大值),
 * 组内比例是真实的, 数值也直接标出来, 不依赖目测。
 * 代价是组间刻度不同, 只能横向比同一项, 不能跨组比柱长。
 */
export function ModelPriceBars({ models }: { models: ModelListItem[] }) {
  const rows = models.filter(
    (model) =>
      model.price_input_hit_idle != null ||
      model.price_input_miss_idle != null ||
      model.price_output_idle != null,
  )

  return (
    <div className="space-y-7">
      {PRICE_ROWS.map((row) => {
        const items = rows
          .map((model) => ({
            id: model.id,
            name: modelDisplayName(model),
            value: model[row.key],
          }))
          .filter((item): item is { id: number; name: string; value: number } =>
            item.value != null,
          )
        if (items.length === 0) return null

        const max = Math.max(...items.map((item) => item.value))

        return (
          <div key={row.key}>
            <div className="flex items-center gap-2 text-xs font-medium">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: row.color }}
              />
              {row.label}
            </div>
            <div className="mt-2.5 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span
                    className="w-36 shrink-0 truncate text-xs text-muted-foreground"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${(item.value / max) * 100}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
