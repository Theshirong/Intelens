import { Link, createFileRoute } from "@tanstack/react-router"
import { ChevronLeft, Inbox } from "lucide-react"
import { useModelList } from "@/api/models"
import { ModelPriceBars } from "@/components/models/price-charts"
import { ModelCard, ModelCardSkeleton } from "@/components/models/model-card"
import { Card } from "@/components/ui/card"
import { modelsOfVendor, vendorLabel } from "@/lib/models"

export const Route = createFileRoute("/_app/models/$company/")({
  component: VendorModelsPage,
})

/** 厂商详情: 该厂商的全部模型 */
function VendorModelsPage() {
  const { company } = Route.useParams()
  const { data, isPending, isError } = useModelList()
  const models = modelsOfVendor(data ?? [], company)

  // 非 token 计费的模型 (三项单价全空) 画不出柱高, 不计入对比图
  const pricedModels = models.filter(
    (model) =>
      model.price_input_hit_idle != null ||
      model.price_input_miss_idle != null ||
      model.price_output_idle != null,
  )

  return (
    <div className="container max-w-5xl py-10">
      <Link
        to="/"
        hash="model-watch"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronLeft className="size-4" />
        返回首页
      </Link>

      <header className="mt-6">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Vendor
        </div>
        <h1 className="mt-1 font-display text-2xl font-black tracking-tight sm:text-3xl">
          {vendorLabel(company)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isPending ? "加载中…" : `共 ${models.length} 个模型`}
        </p>
      </header>

      {!isPending && !isError && models.length > 0 && (
        <Card className="mt-8 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-bold">模型价格对比</h2>
            <span className="text-xs text-muted-foreground">
              美元 / 百万 tokens
            </span>
          </div>
          <div className="mt-4">
            {pricedModels.length > 0 ? (
              <ModelPriceBars models={pricedModels} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                该厂商的模型都按非 token 计费，没有可比的价格
              </p>
            )}
          </div>
        </Card>
      )}

      {isPending ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <ModelCardSkeleton key={index} />
          ))}
        </div>
      ) : isError ? (
        <div className="mt-8 flex min-h-40 items-center justify-center rounded-xl border border-dashed bg-card/50 text-sm text-muted-foreground">
          模型数据加载失败
        </div>
      ) : models.length > 0 ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {models.map((model) => (
            <Link
              key={model.id}
              to="/models/$company/$modelId"
              params={{ company, modelId: String(model.id) }}
              className="block"
            >
              <ModelCard model={model} hint="查看价格走势" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Inbox className="size-8" />
          <p className="text-sm">未找到该厂商的模型</p>
        </div>
      )}
    </div>
  )
}
