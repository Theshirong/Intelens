import { createFileRoute } from "@tanstack/react-router"
import { useNewsList } from "@/api/news"
import { Hero } from "@/components/home/hero"
import { NewsGrid } from "@/components/home/news-grid"
import { ModelWatch } from "@/components/home/model-watch"
import { TrendMap } from "@/components/home/trend-map"
import { Insight } from "@/components/home/insight"

export const Route = createFileRoute("/_app/")({
  component: HomePage,
})

function HomePage() {
  // 首页取第一页: 头条 + 要闻列表 + 实时统计
  const newsQuery = useNewsList({ page: 1, pageSize: 20 })
  const items = newsQuery.data?.items ?? []
  const featured = items[0]
  const rest = items.slice(1, 6)
  const sourceCount = new Set(items.map((item) => item.source_id)).size

  return (
    <>
      <Hero
        total={newsQuery.data?.total}
        sourceCount={sourceCount}
        loading={newsQuery.isPending}
      />
      <NewsGrid featured={featured} rest={rest} loading={newsQuery.isPending} />
      <ModelWatch />
      <TrendMap />
      <Insight />
    </>
  )
}
