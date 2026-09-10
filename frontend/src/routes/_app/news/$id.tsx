import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import Markdown from "react-markdown"
import { ChevronRight, ExternalLink, FileQuestion } from "lucide-react"
import { useNewsDetail } from "@/api/news"
import { BackToTop } from "@/components/news/back-to-top"
import { DocHeader } from "@/components/news/doc-shell"
import { NewsSidebar } from "@/components/news/news-sidebar"
import { NewsToc } from "@/components/news/news-toc"
import { extractMarkdownHeadings } from "@/components/news/markdown-headings"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { formatFullDateTime } from "@/lib/format"

export const Route = createFileRoute("/_app/news/$id")({
  component: NewsDetailPage,
})

/** 文档页统一的内容宽度与留白 */
const DOC_CONTAINER =
  "mx-auto flex w-full max-w-[1400px] flex-1 items-start gap-8 px-4 py-6 sm:px-6 lg:px-8"
/** 吸顶偏移: 页头(两行)高度 + 呼吸空间 */
const STICKY_ASIDE =
  "sticky top-[7rem] hidden max-h-[calc(100vh-8rem)] shrink-0 overflow-y-auto pb-8"
/** 可滚动但不显示滚动条, 避免侧栏出现突兀的滚动条 (Firefox / WebKit) */
const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

/** 页头第二行的面包屑: 新闻 / 最新 / 文章标题 */
function DocBreadcrumb({ title }: { title?: string }) {
  return (
    <nav
      aria-label="面包屑"
      className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-muted-foreground"
    >
      <Link to="/news" className="shrink-0 transition-colors hover:text-foreground">
        新闻
      </Link>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
      <Link to="/news" className="shrink-0 transition-colors hover:text-foreground">
        最新
      </Link>
      {title ? (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
          <span className="truncate text-foreground/75">{title}</span>
        </>
      ) : null}
    </nav>
  )
}

function DocLoading() {
  return (
    <div className={DOC_CONTAINER}>
      <div className="hidden w-[17rem] shrink-0 space-y-2.5 lg:block">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-md" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="mt-6 h-7 w-2/3" />
        <Skeleton className="mt-5 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-4/5" />
        <Skeleton className="mt-8 h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}

function DocNotFound() {
  return (
    <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
        <FileQuestion className="size-10" />
        <p className="font-medium">新闻不存在或已被移除</p>
        <Link
          to="/news"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          返回资讯列表
        </Link>
      </div>
    </div>
  )
}

function NewsDetailPage() {
  const { id } = Route.useParams()
  const { data: news, isPending, isError } = useNewsDetail(Number(id))
  const headings = useMemo(
    () => extractMarkdownHeadings(news?.content ?? ""),
    [news?.content],
  )
  const headingIndex = useRef(0)

  // 窄屏: 目录以抽屉形式浮出; 宽屏: 目录可折叠
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // 视口回到宽屏时收起抽屉, 避免残留遮罩
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const onChange = () => {
      if (media.matches) setNavOpen(false)
    }
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  const handleToggleNav = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setCollapsed((value) => !value)
    } else {
      setNavOpen(true)
    }
  }

  headingIndex.current = 0
  const headingComponents = {
    h2: ({ children }: { children?: ReactNode }) => {
      const heading = headings[headingIndex.current++]
      return (
        <h2 id={heading?.id} className="scroll-mt-32">
          {children}
        </h2>
      )
    },
    h3: ({ children }: { children?: ReactNode }) => {
      const heading = headings[headingIndex.current++]
      return (
        <h3 id={heading?.id} className="scroll-mt-32">
          {children}
        </h3>
      )
    },
  }

  return (
    <div className="flex min-h-screen flex-col bg-card">
      <DocHeader
        onToggleNav={handleToggleNav}
        sidebarOpen={navOpen || !collapsed}
      >
        {isPending ? (
          <Skeleton className="h-4 w-1/3" />
        ) : isError || !news ? (
          <DocBreadcrumb />
        ) : (
          <DocBreadcrumb title={news.title} />
        )}
      </DocHeader>

      {isPending ? (
        <DocLoading />
      ) : isError || !news ? (
        <DocNotFound />
      ) : (
        <div className={DOC_CONTAINER}>
          {!collapsed && (
            <aside
              className={`${STICKY_ASIDE} ${NO_SCROLLBAR} hidden w-[17rem] lg:block`}
            >
              <NewsSidebar activeId={news.id} />
            </aside>
          )}

          <main className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-medium">
                {news.source_name}
              </Badge>
              <span className="tabular-nums">
                发布于 {formatFullDateTime(news.published_at)}
              </span>
              <span className="tabular-nums">
                抓取于 {formatFullDateTime(news.fetched_at)}
              </span>
            </div>

            {news.content ? (
              <article className="prose prose-neutral dark:prose-invert mt-6 max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h3:text-lg prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg">
                <Markdown components={headingComponents}>
                  {news.content}
                </Markdown>
              </article>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                该新闻没有正文内容, 请查看原文。
              </p>
            )}

            <div className="mt-10 flex justify-center border-t pt-6">
              <Button asChild variant="outline" className="bg-card font-medium">
                <a href={news.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  查看原文
                </a>
              </Button>
            </div>
          </main>

          {!collapsed && headings.length > 0 && (
            <aside
              className={`${STICKY_ASIDE} ${NO_SCROLLBAR} hidden w-52 xl:block`}
            >
              <NewsToc headings={headings} />
            </aside>
          )}
        </div>
      )}

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          hideClose
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="flex w-[18rem] max-w-[86vw] flex-col gap-0 p-4 sm:max-w-[18rem]"
        >
          <SheetTitle className="mb-3 text-sm font-bold">资讯目录</SheetTitle>
          <SheetDescription className="sr-only">
            浏览最新资讯, 快速切换到其它文章
          </SheetDescription>
          <NewsSidebar
            activeId={news?.id ?? -1}
            onNavigate={() => setNavOpen(false)}
            className={`min-h-0 flex-1 overflow-y-auto ${NO_SCROLLBAR}`}
          />
        </SheetContent>
      </Sheet>

      <BackToTop />
    </div>
  )
}
