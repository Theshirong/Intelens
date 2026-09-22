import { useEffect, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { ChevronRight, Inbox, MessageSquare, PenLine, Search, X } from "lucide-react"
import { useCreateForumPost, useForumPosts } from "@/api/forum"
import { useMe } from "@/api/auth"
import { Badge } from "@/components/ui/badge"
import { BackHome } from "@/components/layout/back-home"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { SectionHeader } from "@/components/home/hero"
import { formatDateTime } from "@/lib/format"
import { pageWindow } from "@/lib/pagination"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface ForumSearch {
  page?: number
  q?: string
}

export const Route = createFileRoute("/_app/forum/")({
  validateSearch: (search: Record<string, unknown>): ForumSearch => {
    const q = typeof search.q === "string" ? search.q.trim() : undefined
    return { page: Math.max(1, Number(search.page) || 1), q: q || undefined }
  },
  component: ForumPage,
})

const PAGE_SIZE = 10

/** 发帖编辑器: 标题 + 正文 (markdown), 收起时可点「写帖子」展开 */
function PostComposer() {
  const navigate = useNavigate()
  const createPost = useCreateForumPost()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !content.trim()) {
      toast.error("标题和正文都不能为空")
      return
    }
    createPost.mutate(
      { title: title.trim(), content: content.trim() },
      {
        onSuccess: (post) => {
          toast.success("发布成功")
          setTitle("")
          setContent("")
          setOpen(false)
          void navigate({ to: "/forum/$postId", params: { postId: String(post.id) } })
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  if (!open) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="size-4" />
            说说你在 AI 领域的观察、评测或疑问
          </div>
          <Button onClick={() => setOpen(true)}>
            <PenLine className="size-4" />
            写帖子
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="post-title">标题</Label>
            <Input
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="一句话说明你想聊什么"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-content">正文</Label>
            <Textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="支持 markdown, 例如 ## 小标题、- 列表、**加粗**"
              className="min-h-40"
              maxLength={20000}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={createPost.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={createPost.isPending}>
              {createPost.isPending ? "发布中…" : "发布"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ForumPage() {
  const page = Route.useSearch().page ?? 1
  const q = Route.useSearch().q ?? ""
  const navigate = useNavigate({ from: "/forum" })
  const { data: user } = useMe()
  const listQuery = useForumPosts({ page, pageSize: PAGE_SIZE, q })
  const data = listQuery.data
  const totalPages = data?.pages ?? 0
  const [draft, setDraft] = useState(q)

  // 从全站搜索跳转过来时, 输入框跟随 URL 上的关键词
  useEffect(() => setDraft(q), [q])

  const goPage = (next: number) =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, page: next }) })

  const search = (keyword: string) =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, q: keyword || undefined, page: 1 }) })

  return (
    <>
      <BackHome className="mb-5" />

      <SectionHeader
        eyebrow="Forum"
        title="博客论坛"
        action={
          data ? (
            <Badge variant="secondary" className="tabular-nums">
              共 {data.total} 帖
            </Badge>
          ) : undefined
        }
      />

      <p className="mb-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        论坛是本站需要登录的区域: 资讯与模型数据对所有人开放, 发帖和评论请先登录。
        {user ? `当前登录: ${user.username}` : ""}
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PostComposer />
        <form
          onSubmit={(event) => {
            event.preventDefault()
            search(draft.trim())
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="搜索帖子标题或正文"
            aria-label="搜索论坛帖子"
            className="w-64 bg-card pl-9 pr-8"
          />
          {draft && (
            <button
              type="button"
              aria-label="清空关键词"
              onClick={() => {
                setDraft("")
                search("")
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </form>
      </div>

      <Card className="overflow-hidden p-0">
        {listQuery.isPending ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="divide-y">
            {data.items.map((post) => (
              <Link
                key={post.id}
                to="/forum/$postId"
                params={{ postId: String(post.id) }}
                className="group flex items-start gap-4 p-5 transition-colors hover:bg-accent/60"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 font-semibold transition-colors group-hover:text-primary">
                    {post.title}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">
                      {post.author_name}
                    </span>
                    <span className="tabular-nums">{formatDateTime(post.created_at)}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <MessageSquare className="size-3.5" />
                      {post.comment_count}
                    </span>
                  </div>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Inbox className="size-8" />
            <p className="text-sm">
              {q ? `没有匹配「${q}」的帖子` : "还没有帖子, 来发第一帖吧"}
            </p>
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-disabled={page <= 1}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                  onClick={(e) => {
                    e.preventDefault()
                    if (page > 1) goPage(page - 1)
                  }}
                />
              </PaginationItem>
              {pageWindow(page, totalPages).map((p, i) =>
                typeof p === "number" ? (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={p === page}
                      onClick={(e) => {
                        e.preventDefault()
                        goPage(p)
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ) : (
                  <PaginationItem key={i}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-disabled={page >= totalPages}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                  onClick={(e) => {
                    e.preventDefault()
                    if (page < totalPages) goPage(page + 1)
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </>
  )
}
