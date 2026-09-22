import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { SectionHeader, SectionMoreLink } from "@/components/home/hero"
import { useModelList, usePopularityHistory } from "@/api/models"
import { modelDisplayName, vendorLabel } from "@/lib/models"
import type { ModelListItem, ModelPopularityItem } from "@/types/api"

/* ------------------------------------------------------------------ */
/* 数据                                                                */
/* ------------------------------------------------------------------ */

/**
 * 热度趋势 = OpenRouter 周榜的位次
 *
 * 那边只给排序不给热度数值 (sort=top-weekly 与 most-popular 是同一口径, 详见
 * backend/app/crawlers/openrouter_models.py), 所以这里画的是 **名次**: 数字越小
 * 越热, 纵轴因此要反向 (第 1 名在最上面)。跨天比的是涨落 —— 爬榜 / 掉榜,
 * 而不是「热度从 42 涨到 92」那种没有出处的分数。
 */
const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

/** 同时画几条线: 位次榜只看前几名, 线多了颜色分不开 */
const MAX_SERIES = 5

/** 纵轴截到前多少名。更差的位次挤进同一张图会把前面的全压平, 直接断线 */
const RANK_LIMIT = 30

/** 往回看的窗口: 榜单是周口径, 一个月够看出涨落 */
const POPULARITY_DAYS = 30

/** 话题分布: 与趋势图相同的四个实体, 沿用各自系列色 */
const TOPIC_DATA = [
  { label: "AI Agent", value: 34, color: "var(--chart-1)" },
  { label: "大模型", value: 27, color: "var(--chart-2)" },
  { label: "多模态", value: 22, color: "var(--chart-3)" },
  { label: "AI 安全", value: 17, color: "var(--chart-4)" },
]

/** 地域分布: 新的实体集合, 单一系列统一用 1 号色 */
const REGION_DATA = [
  { label: "美国", value: 42 },
  { label: "中国", value: 31 },
  { label: "欧洲", value: 18 },
  { label: "其他", value: 9 },
]

/* ------------------------------------------------------------------ */
/* 位次趋势折线图                                                       */
/* ------------------------------------------------------------------ */

/** 模型展示名: 用 OpenRouter 的模型名, 库里的记录被下架时兜底成 id */
function modelName(model: ModelListItem | undefined, fallbackId: number): string {
  if (model === undefined) return `#${fallbackId}`
  return modelDisplayName(model)
}

function shortName(name: string): string {
  return name.length > 20 ? `${name.slice(0, 19)}…` : name
}

/** 位次轴的刻度: 1 起步, 5 的整倍数, 让区间内落 4-7 个刻度 */
function rankTicks(max: number): number[] {
  const step = [1, 5, 10, 20, 50].find((size) => max / size <= 6) ?? 100
  const ticks: number[] = []
  for (let tick = 1; tick <= max; tick += step) ticks.push(tick)
  return ticks
}

interface RankPoint {
  date: string
  [key: string]: string | number | undefined
}

/** 悬浮提示: 一条竖向十字线列出全部系列, 位次在前、名称在后, 按位次排 */
function RankTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const entries = [...payload].sort((a, b) => Number(a.value) - Number(b.value))
  return (
    <div className="min-w-32 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="mb-1.5 text-xs font-semibold tabular-nums">{label}</div>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-0.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-semibold tabular-nums">第 {entry.value} 名</span>
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 快照不足两天时画不了线, 就把最新一期的位次列出来 (同一份数据, 只是没连成线) */
function RankSnapshotList({
  rows,
  dates,
  models,
}: {
  rows: ModelPopularityItem[]
  dates: string[]
  models: Map<number, ModelListItem>
}) {
  const latest = dates[dates.length - 1]
  const top = rows
    .filter((row) => row.captured_on === latest)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 8)

  return (
    <div className="flex min-h-[280px] flex-col justify-center gap-5 py-6">
      <p className="text-sm text-muted-foreground">
        位次趋势要两天以上的快照才连得成线，目前只有 {dates.length} 天（
        {latest}）。采集按天进行，数据攒够这里就会换成曲线。下面是这一期的位次：
      </p>
      <ol className="space-y-2.5">
        {top.map((row) => {
          const model = models.get(row.model_id)
          return (
            <li key={row.model_id} className="flex items-center gap-3 text-sm">
              <span className="w-8 shrink-0 text-right font-semibold tabular-nums">
                {row.rank}
              </span>
              <span className="w-20 shrink-0 truncate text-muted-foreground">
                {model ? vendorLabel(model.company) : "—"}
              </span>
              <span className="truncate">
                {shortName(modelName(model, row.model_id))}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function PopularityTrend() {
  const popularity = usePopularityHistory(POPULARITY_DAYS)
  const modelList = useModelList()
  const rows = popularity.data ?? []
  const models = new Map((modelList.data ?? []).map((model) => [model.id, model]))

  if (popularity.isPending || modelList.isPending) {
    return <div className="h-[280px] animate-pulse rounded-lg bg-muted/40" />
  }
  if (popularity.isError) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        热度榜数据加载失败
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        暂无热度榜数据
      </div>
    )
  }

  const dates = [...new Set(rows.map((row) => row.captured_on))].sort()
  if (dates.length < 2) {
    return <RankSnapshotList rows={rows} dates={dates} models={models} />
  }

  // 窗口内进过前 RANK_LIMIT 的型号, 按各自最好位次排序取前几条
  const best = new Map<number, number>()
  for (const row of rows) {
    if (row.rank > RANK_LIMIT) continue
    best.set(row.model_id, Math.min(best.get(row.model_id) ?? Infinity, row.rank))
  }
  const picked = [...best.entries()].sort((a, b) => a[1] - b[1]).slice(0, MAX_SERIES)
  if (picked.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        窗口内没有型号进过前 {RANK_LIMIT} 名
      </div>
    )
  }

  const byDate = new Map<string, Map<number, number>>()
  for (const row of rows) {
    const day = byDate.get(row.captured_on) ?? new Map<number, number>()
    day.set(row.model_id, row.rank)
    byDate.set(row.captured_on, day)
  }

  const series = picked.map(([id], index) => ({
    key: `model-${id}`,
    id,
    label: shortName(modelName(models.get(id), id)),
    color: SERIES_COLORS[index % SERIES_COLORS.length],
  }))

  const data: RankPoint[] = dates.map((date) => {
    const point: RankPoint = { date }
    const day = byDate.get(date)
    for (const item of series) {
      const rank = day?.get(item.id)
      // 掉出前 RANK_LIMIT 的日期不写点, 线在那里断开
      if (rank !== undefined && rank <= RANK_LIMIT) point[item.key] = rank
    }
    return point
  })

  const plotted = data.flatMap((point) =>
    series.flatMap((item) => {
      const rank = point[item.key]
      return typeof rank === "number" ? [rank] : []
    }),
  )
  const maxRank = Math.min(RANK_LIMIT, Math.max(...plotted, 1))

  const chartConfig: ChartConfig = Object.fromEntries(
    series.map((item) => [item.key, { label: item.label, color: item.color }]),
  )

  return (
    <>
      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeWidth={1} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickMargin={10}
            tickFormatter={(value: string) => value.slice(5)}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          {/* reversed: 第 1 名在最上面, 符合「越靠上越热」的读图习惯 */}
          <YAxis
            reversed
            domain={[1, maxRank]}
            ticks={rankTicks(maxRank)}
            allowDecimals={false}
            width={40}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `#${value}`}
            tick={{
              fontSize: 12,
              fill: "hsl(var(--muted-foreground))",
              style: { fontVariantNumeric: "tabular-nums" },
            }}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            content={<RankTooltip />}
          />
          {series.map((item) => (
            <Line
              key={item.key}
              dataKey={item.key}
              name={item.label}
              type="monotone"
              stroke={item.color}
              strokeWidth={2}
              strokeLinecap="round"
              dot={{ r: 2.5, strokeWidth: 0, fill: item.color }}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: "hsl(var(--card))",
                fill: item.color,
              }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
      {/* 图例: 短线键 + 名称, 颜色不承载文字 */}
      <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2 px-9">
        {series.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <span
              aria-hidden
              className="h-0.5 w-4 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 横向条形列表 (话题/地域分布)                                          */
/* ------------------------------------------------------------------ */

function BarRow({ label, value, color, max }: { label: string; value: number; color: string; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-right text-sm text-muted-foreground">{label}</div>
      <div className="flex h-5 flex-1 items-center">
        {/* 数据端 4px 圆角, 基线端直角 */}
        <div
          className="h-5 rounded-r-md transition-all"
          style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
        />
        <span className="ml-2.5 text-sm font-semibold tabular-nums">{value}%</span>
      </div>
    </div>
  )
}

function BarList({ data }: { data: Array<{ label: string; value: number; color?: string }> }) {
  const max = Math.max(...data.map((d) => d.value))
  return (
    <div className="flex flex-col justify-center gap-4 py-6">
      {data.map((item) => (
        <BarRow
          key={item.label}
          label={item.label}
          value={item.value}
          color={item.color ?? "var(--chart-1)"}
          max={max}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** AI 趋势图谱: 热度趋势 / 话题分布 / 地域分布 */
export function TrendMap() {
  return (
    <section id="trend-map" className="scroll-mt-20 border-t bg-card/60">
      <div className="container py-14">
        <SectionHeader
          eyebrow="Trend Map"
          title="AI 趋势图谱"
          action={<SectionMoreLink to="/news" label="查看更多" />}
        />
        <Card className="p-5 sm:p-6">
          <Tabs defaultValue="trend">
            <TabsList>
              <TabsTrigger value="trend">热度趋势</TabsTrigger>
              <TabsTrigger value="topic">话题分布</TabsTrigger>
              <TabsTrigger value="region">地域分布</TabsTrigger>
            </TabsList>
            <TabsContent value="trend" className="mt-5">
              <PopularityTrend />
              <p className="mt-4 text-xs text-muted-foreground">
                口径：OpenRouter 周榜位次（按近一周 token 量排序），数字越小越热，
                按天留存快照。掉出前 {RANK_LIMIT} 名的日期曲线断开。
              </p>
            </TabsContent>
            <TabsContent value="topic" className="mt-5">
              <BarList data={TOPIC_DATA} />
            </TabsContent>
            <TabsContent value="region" className="mt-5">
              <BarList data={REGION_DATA} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </section>
  )
}
