import { Link } from "@tanstack/react-router"
import { useModelList } from "@/api/models"
import { ModelPriceScatter } from "@/components/models/model-price-scatter"
import { SectionHeader } from "@/components/home/hero"
import { vendorLabel } from "@/lib/models"

/**
 * 模型追踪: Artificial Analysis 智能指数 × 输出价的分布散点图,
 * 点厂商图例可筛选, 点数据点看三个指数, 卡片底部进该模型的详情页 (含价格历史)。
 */
export function ModelWatch() {
  const { data, isPending, isError } = useModelList()
  const models = data ?? []
  const vendors = [...new Set(models.map((model) => model.company))]

  return (
    <section id="model-watch" className="scroll-mt-20 border-t bg-card/60">
      <div className="container py-14">
        <SectionHeader eyebrow="Model Watch" title="模型追踪" />

        {isPending ? (
          <div className="h-[420px] animate-pulse rounded-xl border bg-card/50" />
        ) : isError ? (
          <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed bg-card/50 text-sm text-muted-foreground">
            模型数据加载失败
          </div>
        ) : models.length > 0 ? (
          <>
            <ModelPriceScatter models={models} />
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span>点击查看模型详情：</span>
              {vendors.map((vendor) => (
                <Link
                  key={vendor}
                  to="/models/$company"
                  params={{ company: vendor }}
                  className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {vendorLabel(vendor)}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed bg-card/50 text-sm text-muted-foreground">
            暂无模型数据
          </div>
        )}
      </div>
    </section>
  )
}
