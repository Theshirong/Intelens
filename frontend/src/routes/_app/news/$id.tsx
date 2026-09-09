import { createFileRoute, Link } from "@tanstack/react-router"
import Markdown from "react-markdown"
import { ArrowLeft, ExternalLink, FileQuestion } from "lucide-react"
import { useNewsDetail } from "@/api/news"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { formatFullDateTime } from "@/lib/format"

export const Route = createFileRoute("/_app/news/$id")({
  component: NewsDetailPage,
})

function NewsDetailPage() {
  const { id } = Route.useParams()
  const { data: news, isPending, isError } = useNewsDetail(Number(id))

  if (isPending) {
    return (
      <div className="container max-w-3xl py-10">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-6 h-10 w-full" />
        <Skeleton className="mt-2 h-10 w-2/3" />
        <Skeleton className="mt-4 h-4 w-1/2" />
        <Skeleton className="mt-8 h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !news) {
    return (
      <div className="container max-w-3xl py-10">
        <Link
          to="/news"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> 返回资讯列表
        </Link>
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
          <FileQuestion className="size-10" />
          <p className="font-medium">新闻不存在或已被移除</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl py-10">
      <Link
        to="/news"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> 返回资讯列表
      </Link>

      <article className="mt-6">
        <header>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="secondary" className="font-medium">
              {news.source_name}
            </Badge>
            <span className="tabular-nums">发布于 {formatFullDateTime(news.published_at)}</span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            {news.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="tabular-nums">抓取时间: {formatFullDateTime(news.fetched_at)}</span>
            <span className="tabular-nums">ID: {news.id}</span>
          </div>
        </header>

        <Separator className="my-6" />

        <Card className="p-6 sm:p-8">
          {news.content ? (
            <div className="prose prose-neutral max-w-none prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg">
              <Markdown>{news.content}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">该新闻没有正文内容, 请查看原文。</p>
          )}
        </Card>

        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" className="bg-white font-medium">
            <a href={news.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              查看原文
            </a>
          </Button>
        </div>
      </article>
    </div>
  )
}
