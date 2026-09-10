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

/* ------------------------------------------------------------------ */
/* 数据 (演示数据)                                                      */
/* ------------------------------------------------------------------ */

const SERIES = [
  { key: "agent", label: "AI Agent", color: "var(--chart-1)" },
  { key: "llm", label: "大模型", color: "var(--chart-2)" },
  { key: "multimodal", label: "多模态", color: "var(--chart-3)" },
  { key: "safety", label: "AI 安全", color: "var(--chart-4)" },
] as const

const TREND_DATA = [
  { date: "09-03", agent: 42, llm: 55, multimodal: 30, safety: 24 },
  { date: "09-04", agent: 48, llm: 58, multimodal: 33, safety: 26 },
  { date: "09-05", agent: 55, llm: 62, multimodal: 38, safety: 25 },
  { date: "09-06", agent: 63, llm: 65, multimodal: 44, safety: 28 },
  { date: "09-07", agent: 78, llm: 70, multimodal: 50, safety: 32 },
  { date: "09-08", agent: 92, llm: 74, multimodal: 58, safety: 36 },
]

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

const chartConfig = {
  agent: { label: "AI Agent", color: "var(--chart-1)" },
  llm: { label: "大模型", color: "var(--chart-2)" },
  multimodal: { label: "多模态", color: "var(--chart-3)" },
  safety: { label: "AI 安全", color: "var(--chart-4)" },
} satisfies ChartConfig

/* ------------------------------------------------------------------ */
/* 热度趋势折线图                                                       */
/* ------------------------------------------------------------------ */

/** 悬浮提示: 一条竖向十字线列出全部系列, 值在前、名称在后 */
function TrendTooltip({
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
    <div className="min-w-32 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="mb-1.5 text-xs font-semibold tabular-nums">{label}</div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-0.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-semibold tabular-nums">{entry.value}</span>
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 仅在折线末端渲染一次系列名 (直接标签, 补充图例) */
function makeEndLabel(name: string) {
  return function EndLabel(props: { x?: number; y?: number; index?: number }) {
    const { x, y, index } = props
    if (index !== TREND_DATA.length - 1 || x === undefined || y === undefined) {
      return <g />
    }
    return (
      <text
        x={x}
        y={y}
        dx={10}
        dy={3.5}
        fontSize={11}
        fontWeight={600}
        fill="hsl(var(--foreground))"
      >
        {name}
      </text>
    )
  }
}

function TrendChart() {
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <LineChart data={TREND_DATA} margin={{ top: 12, right: 72, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeWidth={1} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={{ stroke: "hsl(var(--border))" }}
          tickMargin={10}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          width={32}
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
          content={<TrendTooltip />}
        />
        {SERIES.map((series) => (
          <Line
            key={series.key}
            dataKey={series.key}
            type="monotone"
            stroke={series.color}
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            activeDot={{
              r: 4,
              strokeWidth: 2,
              stroke: "hsl(var(--card))",
              fill: series.color,
            }}
            label={makeEndLabel(series.label)}
          />
        ))}
      </LineChart>
    </ChartContainer>
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
              <TrendChart />
              {/* 图例: 短线键 + 名称, 颜色不承载文字 */}
              <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2 px-9">
                {SERIES.map((series) => (
                  <div key={series.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      aria-hidden
                      className="h-0.5 w-4 rounded-full"
                      style={{ backgroundColor: series.color }}
                    />
                    {series.label}
                  </div>
                ))}
              </div>
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
