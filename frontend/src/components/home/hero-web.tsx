/**
 * Hero 右侧的节点蛛网: 中心 → 厂商 → 该厂商最热的几个模型
 *
 * 数据来自真实接口: `/models` 给厂商与型号, OpenRouter 周榜位次给热度。
 * 展示规则:
 * - 固定展示 5 家: 国内 DeepSeek / GLM / Kimi, 国外 OpenAI / Anthropic;
 * - 每家只画最热的几个型号 (国内 3 个、国外 2 个), 不是每个模型都上墙;
 * - 位置沿用一套调好的锚点, 国内/国外交错落位, 5 家均匀围在中心 ——
 *   屏幕上最终看到的疏密和原来的示例数据一致。
 *
 * 动效说明: 节点用弹簧做轻微漂浮 (不是匀速往复, 所以会互相错开、带回弹),
 * 连线始终是两点之间的直线, 粗细与深浅保持恒定, 只让端点跟着节点走 ——
 * 于是线会被拉长、转向, 有拉扯感但不会弯曲或忽粗忽细。
 * 逐帧直接改 SVG 属性, 不走 React 重渲染。
 */
import { useEffect, useMemo, useRef } from "react"
import { useModelList, usePopularityHistory } from "@/api/models"
import { modelDisplayName } from "@/lib/models"
import { vendorLabel } from "@/lib/vendors"
import type { ModelListItem, ModelPopularityItem } from "@/types/api"

const CENTER_LABEL = "AI 模型生态"

/**
 * 图谱里固定展示的厂商 (国内 3 家、国外 2 家); 想换厂商改这里。
 * 节点上写的是站点统一的厂商名, Anthropic 对应 Claude, OpenAI 对应 GPT。
 */
const VENDORS: Record<"CN" | "US", string[]> = {
  CN: ["deepseek", "zhipu", "kimi"],
  US: ["openai", "anthropic"],
}
/** 每家厂商最多画几个型号: 国内 3 个、国外 2 个 (不够就画全部) */
const MODEL_LIMIT: Record<"CN" | "US", number> = { CN: 3, US: 2 }

/**
 * 厂商锚点: 相对中心的偏移, 手工摆过让 5 家围着中心散开。
 * 国内 / 国外按顺序交替占位, 所以相邻厂商总是「一圆一方」。
 */
const VENDOR_SLOTS: Array<[number, number]> = [
  [-152, -82],
  [-12, -135],
  [172, -78],
  [-139, 103],
  [148, 107],
]

const CENTER = { x: 350, y: 220 }
const FONT_SIZE = { center: 32, vendor: 21, leaf: 17 }
/** 文字与节点之间留一点缝 */
const LEAF_GAP = 5
/** viewBox 四周的留白, 同时给节点漂浮留出余量 */
const PADDING = 12
/** 叶子沿「厂商向外」方向展开: 相邻差 52°, 最多铺开 170° */
const LEAF_STEP_DEG = 52
const LEAF_MAX_SPREAD_DEG = 170
/** 叶子离厂商节点的距离, 按序号轻微错开 */
const LEAF_RADIUS = 80
const LEAF_RADIUS_STEP = 6

interface WebLeaf {
  key: string
  label: string
  x: number
  y: number
  anchor: "start" | "end"
}

interface WebBranch {
  key: string
  label: string
  x: number
  y: number
  leaves: WebLeaf[]
}

/** 粗略估算文字宽度: 中日韩字符按 1 个字宽, 其余按 0.56 */
function textWidth(text: string, fontSize: number) {
  let units = 0
  for (const char of text) {
    units += /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/.test(char)
      ? 1
      : 0.56
  }
  return units * fontSize
}

/** 序号 -> 展开角度 (度)

    叶子数量由数据决定 (2~5 个), 角度按数量均分, 保证不叠在一起。 */
function leafAngles(count: number): number[] {
  if (count <= 1) return [0]
  const spread = Math.min(LEAF_STEP_DEG * (count - 1), LEAF_MAX_SPREAD_DEG)
  return Array.from(
    { length: count },
    (_, index) => -spread / 2 + (spread * index) / (count - 1),
  )
}

/**
 * 叶子标签: 厂商名已经写在上级节点上, 型号名里再带一遍就重复了
 * ("DeepSeek: DeepSeek V4.1 Flash" -> "V4.1 Flash"), 顺带把标签压短,
 * viewBox 不会因为名字长而把整张图缩小。
 */
function leafLabel(name: string, vendor: string): string {
  const stripped = name.startsWith(vendor) ? name.slice(vendor.length) : name
  return stripped.replace(/^[\s·:：\-–—]+/, "").trim() || name
}

/** 周榜位次 -> {模型 id: 最好的名次}; 榜外的型号没有记录 */
function bestRanks(rows: ModelPopularityItem[]): Map<number, number> {
  const ranks = new Map<number, number>()
  for (const row of rows) {
    const current = ranks.get(row.model_id)
    if (current === undefined || row.rank < current) ranks.set(row.model_id, row.rank)
  }
  return ranks
}

interface VendorGroup {
  company: string
  region: "CN" | "US"
  models: ModelListItem[]
}

/**
 * 机型分组: 按固定厂商清单取型号, 厂商内按热度排序 (榜外按入库时间兜底),
 * 最后国内/国外交错排列 —— 同一产地的厂商在图上不会挤在一起。
 */
function pickVendors(
  models: ModelListItem[],
  ranks: Map<number, number>,
): VendorGroup[] {
  const byVendor = new Map<string, ModelListItem[]>()
  for (const model of models) {
    const list = byVendor.get(model.company)
    if (list) list.push(model)
    else byVendor.set(model.company, [model])
  }

  const groupOf = (company: string, region: "CN" | "US") => {
    const list = byVendor.get(company)
    // 清单里的厂商没数据 (或本轮没收录) 就跳过, 不留空节点
    if (!list?.length) return null
    const sorted = [...list].sort((a, b) => {
      const rankA = ranks.get(a.id) ?? Number.MAX_SAFE_INTEGER
      const rankB = ranks.get(b.id) ?? Number.MAX_SAFE_INTEGER
      if (rankA !== rankB) return rankA - rankB
      // 都没上榜时按创建时间兜底, 新的排前面
      return (b.created ?? "").localeCompare(a.created ?? "")
    })
    return {
      company,
      region,
      models: sorted.slice(0, MODEL_LIMIT[region]),
    }
  }

  const domestic = VENDORS.CN.map((company) => groupOf(company, "CN")).filter(
    (group): group is VendorGroup => group !== null,
  )
  const overseas = VENDORS.US.map((company) => groupOf(company, "US")).filter(
    (group): group is VendorGroup => group !== null,
  )
  const ordered: VendorGroup[] = []
  for (let i = 0; i < Math.max(domestic.length, overseas.length); i++) {
    if (domestic[i]) ordered.push(domestic[i])
    if (overseas[i]) ordered.push(overseas[i])
  }
  return ordered
}

/** 把厂商/模型的层级关系摊平成可直接绘制的坐标 */
function buildWeb(groups: VendorGroup[]): WebBranch[] {
  return groups.map((group, branchIndex) => {
    const [offsetX, offsetY] = VENDOR_SLOTS[branchIndex % VENDOR_SLOTS.length]
    const x = CENTER.x + offsetX
    const y = CENTER.y + offsetY
    const outward = Math.atan2(y - CENTER.y, x - CENTER.x)
    const angles = leafAngles(group.models.length)
    const label = vendorLabel(group.company)

    const leaves = group.models.map((model, index) => {
      const angle = outward + (angles[index] * Math.PI) / 180
      const radius = LEAF_RADIUS + (index % 4) * LEAF_RADIUS_STEP
      const anchor: WebLeaf["anchor"] = Math.cos(angle) >= 0 ? "start" : "end"
      return {
        key: `${group.company}-${model.id}`,
        label: leafLabel(modelDisplayName(model), label),
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        anchor,
      }
    })

    return { key: group.company, label, x, y, leaves }
  })
}

/**
 * 按内容(含文字实际宽度)算出 viewBox,
 * 这样无论数据多少、名字多长都不会画到画面外面,
 * SVG 又会随容器等比缩放, 自然跟随页面尺寸。
 */
function computeViewBox(branches: WebBranch[]) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  const trackLabel = (
    x: number,
    y: number,
    text: string,
    fontSize: number,
    anchor: "start" | "end" | "middle",
  ) => {
    const width = textWidth(text, fontSize)
    const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x
    minX = Math.min(minX, left)
    maxX = Math.max(maxX, left + width)
    minY = Math.min(minY, y - fontSize * 0.6)
    maxY = Math.max(maxY, y + fontSize * 0.6)
  }

  trackLabel(CENTER.x, CENTER.y, CENTER_LABEL, FONT_SIZE.center, "middle")
  for (const branch of branches) {
    trackLabel(branch.x, branch.y, branch.label, FONT_SIZE.vendor, "middle")
    for (const leaf of branch.leaves) {
      trackLabel(
        leaf.x + (leaf.anchor === "start" ? LEAF_GAP : -LEAF_GAP),
        leaf.y,
        leaf.label,
        FONT_SIZE.leaf,
        leaf.anchor,
      )
    }
  }

  return {
    x: minX - PADDING,
    y: minY - PADDING,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  }
}

/* ---------------- 图谱数据结构 ---------------- */

interface WebNode {
  key: string
  kind: "center" | "vendor" | "leaf"
  /** 连线端点坐标 (静止位置) */
  x: number
  y: number
  label: string
  /** 文字位置, 与端点错开一点缝 */
  textX: number
  textY: number
  fontSize: number
  anchor: "start" | "middle" | "end"
  textClassName: string
  fillOpacity?: number
}

interface WebEdge {
  key: string
  from: number
  to: number
}

function buildGraph(branches: WebBranch[]) {
  const nodes: WebNode[] = [
    {
      key: "center",
      kind: "center",
      x: CENTER.x,
      y: CENTER.y,
      label: CENTER_LABEL,
      textX: CENTER.x,
      textY: CENTER.y,
      fontSize: FONT_SIZE.center,
      anchor: "middle",
      textClassName: "fill-foreground font-display font-black",
    },
  ]
  const edges: Array<Pick<WebEdge, "key" | "from" | "to">> = []

  for (const branch of branches) {
    const vendorKey = `v:${branch.key}`
    nodes.push({
      key: vendorKey,
      kind: "vendor",
      x: branch.x,
      y: branch.y,
      label: branch.label,
      textX: branch.x,
      textY: branch.y,
      fontSize: FONT_SIZE.vendor,
      anchor: "middle",
      textClassName: "fill-foreground font-semibold",
    })
    const vendorIndex = nodes.length - 1
    edges.push({ key: `c:${branch.key}`, from: 0, to: vendorIndex })

    for (const leaf of branch.leaves) {
      nodes.push({
        key: `l:${leaf.key}`,
        kind: "leaf",
        x: leaf.x,
        y: leaf.y,
        label: leaf.label,
        textX: leaf.x + (leaf.anchor === "start" ? LEAF_GAP : -LEAF_GAP),
        textY: leaf.y,
        fontSize: FONT_SIZE.leaf,
        anchor: leaf.anchor,
        textClassName: "fill-foreground",
        fillOpacity: 0.55,
      })
      edges.push({ key: `l:${leaf.key}`, from: vendorIndex, to: nodes.length - 1 })
    }
  }

  return {
    nodes,
    edges: edges satisfies WebEdge[],
    viewBox: computeViewBox(branches),
  }
}

/** 每个节点漂浮的幅度与频率: 越靠近叶子晃得越明显 */
function motionOf(kind: WebNode["kind"], index: number) {
  if (kind === "center") return { amplitude: 0, speed: 0, phase: 0 }
  const amplitude = kind === "vendor" ? 6.5 : 9
  const speed = kind === "vendor" ? 0.62 : 1.05
  return { amplitude, speed, phase: index * 1.37 }
}

/** 弹簧系数 / 阻尼: 阻尼小一点, 节点会过冲再回弹 */
const SPRING = 0.07
const DAMPING = 0.9
/**
 * 漂浮幅度的渐入时长:
 * 首帧的目标点是 home + sin(相位)·幅度, 一上来就按满幅起步会看到节点抽一下,
 * 所以让幅度从 0 平滑升到满值, 开头与静态首帧完全对齐。
 */
const RAMP_SECONDS = 1.4

/** 装饰性的节点蛛网, 节点缓慢漂浮, 连线随之被拉扯 */
export function HeroWeb() {
  const modelsQuery = useModelList()
  // 与首页的位次趋势图共用同一个查询 (默认 30 天), 不会多发一次请求
  const popularityQuery = usePopularityHistory()
  const nodeRefs = useRef<Array<SVGGElement | null>>([])
  const edgeRefs = useRef<Array<SVGLineElement | null>>([])

  const graph = useMemo(
    () =>
      buildGraph(
        buildWeb(
          pickVendors(
            modelsQuery.data ?? [],
            bestRanks(popularityQuery.data ?? []),
          ),
        ),
      ),
    [modelsQuery.data, popularityQuery.data],
  )

  const { nodes, edges } = graph
  const empty = nodes.length <= 1

  useEffect(() => {
    if (empty) return
    // 尊重系统的「减少动态效果」: 保持静止的蛛网
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const points = nodes.map((node, index) => {
      const motion = motionOf(node.kind, index)
      return {
        ...motion,
        homeX: node.x,
        homeY: node.y,
        x: node.x,
        y: node.y,
        vx: 0,
        vy: 0,
      }
    })
    let frame = 0
    let last = performance.now()
    let clock = 0
    let accumulator = 0
    const STEP = 1 / 60

    const simulate = (dt: number) => {
      clock += dt
      // smoothstep 渐入: 起始速度为 0, 不会突然抽动
      const progress = Math.min(1, clock / RAMP_SECONDS)
      const ramp = progress * progress * (3 - 2 * progress)
      for (const point of points) {
        if (point.amplitude === 0) continue
        const targetX =
          point.homeX +
          Math.sin(clock * point.speed + point.phase) * point.amplitude * ramp
        const targetY =
          point.homeY +
          Math.cos(clock * point.speed * 0.83 + point.phase * 1.7) *
            point.amplitude *
            ramp
        point.vx = (point.vx + (targetX - point.x) * SPRING) * DAMPING
        point.vy = (point.vy + (targetY - point.y) * SPRING) * DAMPING
        point.x += point.vx
        point.y += point.vy
      }
    }

    const draw = () => {
      for (let i = 0; i < nodes.length; i++) {
        const el = nodeRefs.current[i]
        if (!el) continue
        const point = points[i]
        const dx = point.x - point.homeX
        const dy = point.y - point.homeY
        el.setAttribute("transform", `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`)
      }

      for (let i = 0; i < edges.length; i++) {
        const el = edgeRefs.current[i]
        if (!el) continue
        const edge = edges[i]
        const from = points[edge.from]
        const to = points[edge.to]

        // 始终是直线: 只把两端挪到节点当前位置
        el.setAttribute("x1", from.x.toFixed(2))
        el.setAttribute("y1", from.y.toFixed(2))
        el.setAttribute("x2", to.x.toFixed(2))
        el.setAttribute("y2", to.y.toFixed(2))
      }
    }

    const tick = (now: number) => {
      accumulator += Math.min((now - last) / 1000, 0.1)
      last = now
      // 首帧或卡顿帧可能攒下较长时间, 限制一次补的步数, 免得节点瞬移
      accumulator = Math.min(accumulator, STEP * 4)
      // 固定步长推进, 保证高刷屏与 60Hz 的手感一致
      while (accumulator >= STEP) {
        simulate(STEP)
        accumulator -= STEP
      }
      draw()
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [empty, nodes, edges])

  // 数据没回来时不画空坐标系, 占住同样大小的位置免得页面跳一下
  if (empty) return <div aria-hidden className="aspect-[10/9] w-full" />

  const { x, y, width, height } = graph.viewBox

  return (
    <svg
      viewBox={`${x} ${y} ${width} ${height}`}
      className="h-auto w-full"
      fill="none"
      role="presentation"
    >
      {/* 连线: 中心 → 厂家 → 模型, 直线但端点跟着节点走 */}
      <g stroke="currentColor">
        {edges.map((edge, index) => {
          const from = nodes[edge.from]
          const to = nodes[edge.to]
          return (
            <line
              key={edge.key}
              ref={(el) => {
                edgeRefs.current[index] = el
              }}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              strokeOpacity={0.18}
              strokeWidth={1}
            />
          )
        })}
      </g>

      {/* 节点: 一级节点不动, 二三级节点缓慢漂浮 */}
      {nodes.map((node, index) => (
        <g
          key={node.key}
          ref={(el) => {
            nodeRefs.current[index] = el
          }}
          style={{ willChange: "transform" }}
        >
          <text
            x={node.textX}
            y={node.textY}
            textAnchor={node.anchor}
            dominantBaseline="middle"
            className={node.textClassName}
            fontSize={node.fontSize}
            fillOpacity={node.fillOpacity}
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
