import { useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRight, X } from "lucide-react"
import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { formatPrice } from "@/lib/format"
import { analysisIndices, modelDisplayName, vendorLabel } from "@/lib/models"
import { cn } from "@/lib/utils"
import { vendorRegion } from "@/lib/vendors"
import type { ModelListItem } from "@/types/api"

/**
 * 厂商配色: 一家一色, 色相拉开 (主题里的 --chart-N 只有 5 个, 10 家厂商会撞色,
 * 撞色的两家在图上就分不出来了), 所以这里固定一套 10 色的高区分度色板。
 */
const VENDOR_COLORS: Record<string, string> = {
  deepseek: "#1C7ED6",
  openai: "#0CA678",
  anthropic: "#E8590C",
  google: "#F59F00",
  meta: "#364FC7",
  kimi: "#D6336C",
  mimo: "#AE3EC9",
  qwen: "#7048E8",
  tencent: "#1098AD",
  zhipu: "#2F9E44",
}

/** 色板之外的厂商按出现顺序兜底 */
const FALLBACK_COLORS = ["#1C7ED6", "#0CA678", "#E8590C", "#D6336C", "#AE3EC9"]

/**
 * 形状按产地分: 美国方块、中国圆点、其它菱形 —— 颜色之外再给一层编码,
 * 同一产地内部的厂商差异靠颜色认。
 */
const REGION_SHAPES: Record<string, "circle" | "square" | "diamond"> = {
  CN: "circle",
  US: "square",
  other: "diamond",
}

function shapeOf(vendor: string): "circle" | "square" | "diamond" {
  return REGION_SHAPES[vendorRegion(vendor)] ?? "diamond"
}

/** 对数轴的刻度: 1 / 2 / 5 × 10^n, 落在取值范围内 */
function logTicks(min: number, max: number): number[] {
  const ticks: number[] = []
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const step of [1, 2, 5]) {
      const tick = step * 10 ** e
      if (tick >= min && tick <= max) ticks.push(tick)
    }
  }
  return ticks
}

/** 中位数, 用来把平面切成四块 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/** 指数轴的刻度: 取整倍数, 让区间内落 4-7 个刻度 */
function indexTicks(min: number, max: number): number[] {
  const span = max - min
  const step = [2, 5, 10, 20, 50].find((size) => span / size <= 6) ?? 100
  const ticks: number[] = []
  for (let tick = Math.ceil(min / step) * step; tick <= max; tick += step) {
    ticks.push(tick)
  }
  return ticks
}

interface ScatterPoint {
  id: number
  company: string
  name: string
  /** Artificial Analysis 的三个指数 (来自 OpenRouter 目录的 benchmarks) */
  intelligence: number
  coding: number | null
  agentic: number | null
  output: number
  inputMiss: number
  inputHit: number | null
}

/** 悬停预览: 只给名称、智能指数和输出价, 展开的信息留给点击后的卡片 */
function HoverTip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: ScatterPoint }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="text-xs font-bold">{point.name}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        智能指数{" "}
        <span className="font-semibold tabular-nums">
          {point.intelligence.toFixed(1)}
        </span>
        {" · "}
        输出{" "}
        <span className="font-semibold tabular-nums">
          {formatPrice(point.output)}
        </span>
      </div>
    </div>
  )
}

/** 点击后钉住的详情卡: 价格与能力分项都摊开, 进详情页要走卡片底部的按钮 */
function PinnedCard({
  point,
  onClose,
  onOpen,
}: {
  point: ScatterPoint
  onClose: () => void
  onOpen: () => void
}) {
  const priceRows: Array<[string, string]> = [
    ["输出", `${formatPrice(point.output)} /1M`],
    ["输入（未命中）", `${formatPrice(point.inputMiss)} /1M`],
    ["输入（命中缓存）", `${formatPrice(point.inputHit)} /1M`],
  ]

  return (
    <div className="overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{point.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {vendorLabel(point.company)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <dl className="space-y-1.5 px-3 py-3">
        {priceRows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 text-xs"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <dl className="space-y-1.5 border-t px-3 py-3">
        <div className="text-xs font-semibold">Artificial Analysis</div>
        <div className="flex items-baseline justify-between gap-4 text-xs">
          <dt className="text-muted-foreground">智能指数</dt>
          <dd className="font-semibold tabular-nums">
            {point.intelligence.toFixed(1)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 text-xs">
          <dt className="text-muted-foreground">编程指数</dt>
          <dd className="tabular-nums">
            {point.coding != null ? point.coding.toFixed(1) : "—"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 text-xs">
          <dt className="text-muted-foreground">Agent 指数</dt>
          <dd className="tabular-nums">
            {point.agentic != null ? point.agentic.toFixed(1) : "—"}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-center gap-1 border-t py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-muted"
      >
        查看详情
        <ArrowRight className="size-3.5" />
      </button>
    </div>
  )
}

/**
 * 模型能力与价格散点图
 *
 * X = 输出价 (对数刻度), Y = Artificial Analysis 智能指数 (来自 OpenRouter
 * 目录的 benchmarks) —— 回答「这个价钱买到多少能力」。两条中位线把平面切成
 * 四块, 左上角是「价格低于中位、能力高于中位」的划算区。
 *
 * 目录里没有智能指数的型号不画入: 能力轴只有一个来源才可比, 缺指数的型号数量
 * 在副标题里说明。
 *
 * 交互: 悬停看简要预览; 点击钉住详情卡; 卡片底部「查看详情」进详情页。
 * 图例支持多选: 一家都没选 = 全部显示, 选中的若干家高亮, 其余变淡。
 */
export function ModelPriceScatter({ models }: { models: ModelListItem[] }) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  // 图例多选: 空集合 = 不过滤(全部厂商都在图上), 否则只高亮选中的这几家
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pinned, setPinned] = useState<{
    point: ScatterPoint
    x: number
    y: number
    below: boolean
  } | null>(null)

  // 有智能指数、也有输出价, 才能落到平面上
  const points: ScatterPoint[] = models
    .flatMap((model) => {
      const indices = analysisIndices(model)
      if (indices.intelligence == null || model.price_output_idle == null) return []
      return [
        {
          id: model.id,
          company: model.company,
          name: modelDisplayName(model),
          intelligence: indices.intelligence,
          coding: indices.coding,
          agentic: indices.agentic,
          output: model.price_output_idle as number,
          inputMiss:
            model.price_input_miss_idle ?? (model.price_output_idle as number),
          inputHit: model.price_input_hit_idle,
        },
      ]
    })

  // 两类缺席原因分开说: 没有智能指数 vs 没有输出价(价格轴上没有位置)
  const unpriced = models.filter((model) => model.price_output_idle == null)
  const unranked = models.filter(
    (model) =>
      model.price_output_idle != null &&
      analysisIndices(model).intelligence == null,
  )

  const vendors = [...new Set(points.map((point) => point.company))]
  const colorOf = (company: string) =>
    VENDOR_COLORS[company] ??
    FALLBACK_COLORS[vendors.indexOf(company) % FALLBACK_COLORS.length]

  const chartConfig: ChartConfig = Object.fromEntries(
    vendors.map((vendor) => [
      vendor,
      { label: vendorLabel(vendor), color: colorOf(vendor) },
    ]),
  )

  const prices = points.map((point) => point.output)
  const min = prices.length > 0 ? Math.min(...prices) : 0.1
  const max = prices.length > 0 ? Math.max(...prices) : 10
  const domain: [number, number] = [min / 2, max * 2]
  const ticks = logTicks(domain[0], domain[1])
  const indices = points.map((point) => point.intelligence)
  const indexMin = indices.length > 0 ? Math.min(...indices) : 0
  const indexMax = indices.length > 0 ? Math.max(...indices) : 100
  const indexDomain: [number, number] = [indexMin - 2, indexMax + 2]
  const indexMedian = median(indices)
  const priceMedian = median(prices)

  const toggle = (vendor: string) => {
    setPinned(null)
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(vendor)) next.add(vendor)
      return next
    })
  }

  const clearSelection = () => {
    setPinned(null)
    setSelected(new Set())
  }

  // 一个有指数的都没有时, 空白坐标系只会让人以为是画的姿势不对
  if (points.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-bold">模型能力与价格</h3>
        <p className="mt-4 flex min-h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          暂无同时有智能指数与输出价的型号
        </p>
      </div>
    )
  }

  const handlePointClick = (
    point: ScatterPoint,
    event?: { clientX: number; clientY: number },
  ) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || !event) {
      setPinned({ point, x: 12, y: 12, below: true })
      return
    }
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    setPinned({
      point,
      // 卡片宽 240, 靠右时往里收, 免得溢出容器
      x: Math.min(Math.max(localX, 8), Math.max(rect.width - 248, 8)),
      y: localY,
      // 上半屏往下弹, 下半屏往上弹
      below: localY < rect.height / 2,
    })
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">模型能力与价格</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            横轴输出价（对数轴）、纵轴智能指数；左上角 = 能力高且价格低
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            智能指数取自 OpenRouter 目录的 Artificial Analysis
            {unranked.length > 0 && `；${unranked.length} 个型号缺指数未画入`}
            {unpriced.length > 0 && `；${unpriced.length} 个型号缺价格未画入`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {vendors.map((vendor) => {
            const on = selected.size === 0 || selected.has(vendor)
            return (
              <button
                key={vendor}
                type="button"
                onClick={() => toggle(vendor)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-transparent bg-muted text-foreground"
                    : "border-border text-muted-foreground opacity-50",
                )}
              >
                {/* 色块同时体现形状编码, 图例与图上的点对得上 */}
                <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 shrink-0">
                  {shapeOf(vendor) === "square" ? (
                    <rect x="1" y="1" width="8" height="8" rx="1" fill={colorOf(vendor)} />
                  ) : shapeOf(vendor) === "diamond" ? (
                    <path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill={colorOf(vendor)} />
                  ) : (
                    <circle cx="5" cy="5" r="4.2" fill={colorOf(vendor)} />
                  )}
                </svg>
                {vendorLabel(vendor)}
              </button>
            )
          })}
          <span className="text-xs text-muted-foreground/70">
            形状：圆形=中国、方形=美国
          </span>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
            >
              显示全部（已选 {selected.size} 家）
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative mt-4 [&_.recharts-symbols]:cursor-pointer"
      >
        <ChartContainer config={chartConfig} className="h-[360px] w-full">
          <ScatterChart margin={{ top: 24, right: 32, bottom: 24, left: 8 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.7}
            />
            <XAxis
              type="number"
              dataKey="output"
              scale="log"
              domain={domain}
              ticks={ticks}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickMargin={8}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              label={{
                value: "输出价（美元 / 百万 tokens，对数轴）",
                position: "insideBottom",
                offset: -14,
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
            <YAxis
              type="number"
              dataKey="intelligence"
              domain={indexDomain}
              ticks={indexTicks(indexDomain[0], indexDomain[1])}
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              label={{
                value: "智能指数（越高越强）",
                angle: -90,
                position: "insideLeft",
                offset: 8,
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))",
                style: { textAnchor: "middle" },
              }}
            />
            <ReferenceLine
              x={priceMedian}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              strokeOpacity={0.4}
              label={{
                value: `价格中位 ${formatPrice(priceMedian)}`,
                position: "insideTopRight",
                fontSize: 10,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
            <ReferenceLine
              y={indexMedian}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              strokeOpacity={0.4}
              label={{
                value: `指数中位 ${indexMedian.toFixed(1)}`,
                position: "insideTopLeft",
                fontSize: 10,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "hsl(var(--border))" }}
              content={<HoverTip />}
            />
            {vendors.map((vendor) => (
              <Scatter
                key={vendor}
                name={vendorLabel(vendor)}
                data={points.filter((point) => point.company === vendor)}
                shape={shapeOf(vendor)}
                fill={colorOf(vendor)}
                fillOpacity={
                  selected.size === 0 || selected.has(vendor) ? 0.85 : 0.12
                }
                onClick={(...args: unknown[]) => {
                  // recharts 的入参顺序在版本间有差异, 按特征各取各的
                  const point = args.find(
                    (arg): arg is ScatterPoint =>
                      typeof arg === "object" && arg !== null && "company" in arg,
                  )
                  const event = args.find(
                    (arg): arg is MouseEvent =>
                      typeof arg === "object" && arg !== null && "clientX" in arg,
                  )
                  if (point) handlePointClick(point, event)
                }}
              />
            ))}
          </ScatterChart>
        </ChartContainer>

        {pinned && (
          <div
            className="absolute z-10 w-60"
            style={{
              left: pinned.x,
              top: pinned.y,
              transform: pinned.below
                ? "translateY(14px)"
                : "translateY(calc(-100% - 14px))",
            }}
          >
            <PinnedCard
              point={pinned.point}
              onClose={() => setPinned(null)}
              onOpen={() =>
                void navigate({
                  to: "/models/$company/$modelId",
                  params: {
                    company: pinned.point.company,
                    modelId: String(pinned.point.id),
                  },
                })
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
