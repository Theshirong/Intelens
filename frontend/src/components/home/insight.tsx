import { Badge } from "@/components/ui/badge"
import { SectionHeader, SectionMoreLink } from "@/components/home/hero"

interface InsightItem {
  tag: string
  date: string
  title: string
  summary: string
  category: string
}

const REPORTS: InsightItem[] = [
  {
    tag: "深研究",
    date: "09-06",
    title: "AI Agent 商业化落地的关键路径与挑战",
    summary: "从技术、产品、生态三个维度，分析 AI Agent 的商业化进程与未来发展方向。",
    category: "行业分析",
  },
  {
    tag: "深研究",
    date: "09-05",
    title: "2025 年全球大模型竞争格局分析",
    summary: "对比主要玩家的能力边界、生态布局与市场策略，挖掘未来的竞争机会。",
    category: "行业分析",
  },
  {
    tag: "深研究",
    date: "09-03",
    title: "AI 产业链投融资趋势与热点赛道",
    summary: "基于最新投融资数据，梳理 AI 产业链的资金流向与值得关注的赛道。",
    category: "行业分析",
  },
]

/** 研究洞察: 深度报告卡片 (演示数据) */
export function Insight() {
  return (
    <section id="insight" className="scroll-mt-20 border-t bg-card/60">
      <div className="container py-14">
        <SectionHeader
          eyebrow="Insight"
          title="研究洞察"
          action={<SectionMoreLink to="/news" label="查看更多" />}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {REPORTS.map((report) => (
            <article
              key={report.title}
              className="group flex flex-col rounded-xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <Badge className="font-medium">{report.tag}</Badge>
                <span className="text-xs text-muted-foreground tabular-nums">{report.date}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold leading-snug tracking-tight transition-colors group-hover:text-primary">
                {report.title}
              </h3>
              <p className="mt-2.5 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {report.summary}
              </p>
              <div className="mt-5 flex items-center justify-between border-t pt-3">
                <Badge variant="secondary" className="text-xs font-medium">
                  {report.category}
                </Badge>
                <span className="text-xs text-muted-foreground tabular-nums">{report.date}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
