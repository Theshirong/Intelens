import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import type { LinkProps } from "@tanstack/react-router"
import { Boxes, CornerDownLeft, FileText, MessageSquare, Search } from "lucide-react"
import { useNewsList } from "@/api/news"
import { useModelList } from "@/api/models"
import { useForumPosts } from "@/api/forum"
import { useAuthStore } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { modelDisplayName } from "@/lib/models"
import { vendorLabel } from "@/lib/vendors"
import { formatDateTime } from "@/lib/format"

/** 输入停顿后再发请求, 避免每敲一个字都打一次接口 */
function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

interface ResultItem {
  key: string
  title: string
  meta: string
  icon: React.ReactNode
  run: () => void
}

interface ResultSection {
  label: string
  items: ResultItem[]
}

const QUICK_LINKS: Array<{
  label: string
  hint: string
  to: LinkProps["to"]
  hash?: LinkProps["hash"]
}> = [
  { label: "最新资讯", hint: "浏览全部抓取的新闻", to: "/news" },
  { label: "模型动态", hint: "价格与规格对比", to: "/", hash: "model-watch" },
  { label: "博客论坛", hint: "登录后可发帖与评论", to: "/forum" },
]

/**
 * 全站搜索: 顶栏放大镜打开, 也可用 ⌘K / Ctrl+K。
 * 一次搜资讯、模型与论坛帖子, 键盘 ↑↓ 选、Enter 打开。
 */
export function GlobalSearch() {
  const navigate = useNavigate()
  const authed = Boolean(useAuthStore((s) => s.accessToken))
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [active, setActive] = useState(0)
  const query = useDebounced(keyword).trim()

  // 关掉时清空关键词: 下次打开是干净的搜索框。
  // 点 X / Esc / 点遮罩 / ⌘K 收起都会走到这里, 不用各处单独清
  useEffect(() => {
    if (!open) setKeyword("")
  }, [open])

  // 空关键词时给快捷入口 + 最新资讯, 有关键词再搜三类内容
  const newsQuery = useNewsList({
    page: 1,
    pageSize: query ? 5 : 4,
    q: query || undefined,
  })
  const modelsQuery = useModelList(query || undefined)
  const forumQuery = useForumPosts({
    pageSize: 5,
    q: query || undefined,
    enabled: open && authed && Boolean(query),
  })

  // ⌘K / Ctrl+K 唤起
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open) setActive(0)
  }, [open, query])

  const sections = useMemo<ResultSection[]>(() => {
    const go = (run: () => void) => () => {
      setOpen(false)
      setKeyword("")
      run()
    }

    if (!query) {
      return [
        {
          label: "快捷入口",
          items: QUICK_LINKS.map((link) => ({
            key: `quick-${link.label}`,
            title: link.label,
            meta: link.hint,
            icon: <CornerDownLeft className="size-4 text-muted-foreground" />,
            run: go(() => void navigate({ to: link.to, hash: link.hash })),
          })),
        },
        {
          label: "最新资讯",
          items: (newsQuery.data?.items ?? []).map((item) => ({
            key: `news-${item.id}`,
            title: item.title,
            meta: `${vendorLabel(item.source_name)} · ${formatDateTime(item.published_at)}`,
            icon: <FileText className="size-4 text-muted-foreground" />,
            run: go(() =>
              void navigate({ to: "/news/$id", params: { id: String(item.id) } }),
            ),
          })),
        },
      ]
    }

    const newsItems: ResultItem[] = (newsQuery.data?.items ?? []).map((item) => ({
      key: `news-${item.id}`,
      title: item.title,
      meta: `${vendorLabel(item.source_name)} · ${formatDateTime(item.published_at)}`,
      icon: <FileText className="size-4 text-muted-foreground" />,
      run: go(() => void navigate({ to: "/news/$id", params: { id: String(item.id) } })),
    }))
    if (newsItems.length > 0) {
      newsItems.push({
        key: "news-all",
        title: `查看全部 ${newsQuery.data?.total ?? 0} 条资讯`,
        meta: "在资讯列表里继续筛选",
        icon: <Search className="size-4 text-muted-foreground" />,
        run: go(() => void navigate({ to: "/news", search: { q: query, page: 1 } })),
      })
    }

    const modelItems: ResultItem[] = (modelsQuery.data ?? [])
      .slice(0, 5)
      .map((model) => ({
        key: `model-${model.id}`,
        // 与模型卡片一致: 展示 OpenRouter 的模型名 (剥掉厂商前缀)
        title: modelDisplayName(model),
        meta: vendorLabel(model.company),
        icon: <Boxes className="size-4 text-muted-foreground" />,
        run: go(() =>
          void navigate({
            to: "/models/$company/$modelId",
            params: { company: model.company, modelId: String(model.id) },
          }),
        ),
      }))

    const forumItems: ResultItem[] = (forumQuery.data?.items ?? []).map((post) => ({
      key: `post-${post.id}`,
      title: post.title,
      meta: `${post.author_name} · ${formatDateTime(post.created_at)}`,
      icon: <MessageSquare className="size-4 text-muted-foreground" />,
      run: go(() =>
        void navigate({ to: "/forum/$postId", params: { postId: String(post.id) } }),
      ),
    }))
    if (forumItems.length > 0) {
      forumItems.push({
        key: "forum-all",
        title: `查看全部 ${forumQuery.data?.total ?? 0} 条帖子`,
        meta: "在论坛列表里继续筛选",
        icon: <Search className="size-4 text-muted-foreground" />,
        run: go(() => void navigate({ to: "/forum", search: { q: query, page: 1 } })),
      })
    }

    const result: ResultSection[] = [
      { label: "资讯", items: newsItems },
      { label: "模型", items: modelItems },
    ]
    // 论坛需要登录, 未登录时不展示该分组
    if (authed) result.push({ label: "论坛", items: forumItems })
    return result.filter((section) => section.items.length > 0)
  }, [query, authed, navigate, newsQuery.data, modelsQuery.data, forumQuery.data])

  const flat = useMemo(() => sections.flatMap((section) => section.items), [sections])
  const nothingFound =
    Boolean(query) &&
    sections.length === 0 &&
    !newsQuery.isFetching &&
    !modelsQuery.isFetching &&
    !forumQuery.isFetching

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => (flat.length ? (index + 1) % flat.length : 0))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) =>
        flat.length ? (index - 1 + flat.length) % flat.length : 0,
      )
    } else if (event.key === "Enter") {
      event.preventDefault()
      flat[active]?.run()
    }
  }

  let cursor = -1

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="全站搜索"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">全站搜索</DialogTitle>

          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="搜索资讯 / 模型 / 论坛帖子…"
              className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {sections.map((section) => (
              <div key={section.label} className="mb-1">
                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </div>
                {section.items.map((item) => {
                  cursor += 1
                  const index = cursor
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={item.run}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                        index === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                      )}
                    >
                      {item.icon}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-medium">{item.title}</span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {item.meta}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}

            {nothingFound && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                没有找到与「{query}」相关的内容
              </p>
            )}
          </div>

          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
            {authed ? (
              <span>已包含论坛帖子</span>
            ) : (
              <span>登录后可搜索论坛帖子</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
