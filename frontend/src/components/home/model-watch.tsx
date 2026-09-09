import { Badge } from "@/components/ui/badge"
import { SectionHeader, SectionMoreLink } from "@/components/home/hero"

interface ModelCard {
  name: string
  vendor: string
  context: string
  tags: string[]
  releaseDate: string
  trend: string
}

const MODELS: ModelCard[] = [
  {
    name: "GPT-5.2",
    vendor: "OpenAI",
    context: "128K",
    tags: ["多模态", "推理"],
    releaseDate: "2025-09",
    trend: "+12%",
  },
  {
    name: "Claude 3.7",
    vendor: "Anthropic",
    context: "200K",
    tags: ["推理", "代码"],
    releaseDate: "2025-08",
    trend: "+8%",
  },
  {
    name: "Gemini 2.5 Pro",
    vendor: "Google",
    context: "1M",
    tags: ["多模态", "推理"],
    releaseDate: "2025-05",
    trend: "+15%",
  },
  {
    name: "DeepSeek V4",
    vendor: "DeepSeek",
    context: "128K",
    tags: ["通用", "代码"],
    releaseDate: "2025-08",
    trend: "+20%",
  },
]

/** 模型追踪: 主流模型卡片 (演示数据) */
export function ModelWatch() {
  return (
    <section id="model-watch" className="scroll-mt-20 border-t bg-white/60">
      <div className="container py-14">
        <SectionHeader
          eyebrow="Model Watch"
          title="模型追踪"
          action={<SectionMoreLink to="/news" label="查看全部" />}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODELS.map((model) => (
            <article
              key={model.name}
              className="group rounded-xl border bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold tracking-tight transition-colors group-hover:text-primary">
                    {model.name}
                  </h3>
                  <div className="text-xs text-muted-foreground">{model.vendor}</div>
                </div>
                <Badge variant="outline" className="border-emerald-600/30 text-emerald-700 tabular-nums">
                  ↑ {model.trend}
                </Badge>
              </div>

              <div className="mt-5">
                <div className="text-xs text-muted-foreground">上下文窗口</div>
                <div className="font-display text-2xl font-black tabular-nums">{model.context}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {model.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs font-medium">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>发布时间</span>
                <span className="font-medium tabular-nums">{model.releaseDate}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
