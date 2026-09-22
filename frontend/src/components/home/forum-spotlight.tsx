import { Link } from "@tanstack/react-router"
import { Lock, MessageSquare } from "lucide-react"
import { useForumPosts } from "@/api/forum"
import { useAuthStore } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionHeader } from "@/components/home/hero"
import { formatDateTime } from "@/lib/format"

/**
 * 首页论坛入口:
 * 站点本身免登录, 论坛需要登录 —— 未登录时给一张引导卡,
 * 已登录时直接列出最新讨论。
 */
export function ForumSpotlight() {
  const authed = Boolean(useAuthStore((s) => s.accessToken))
  const { data, isPending } = useForumPosts({ pageSize: 3, enabled: authed })
  const posts = data?.items ?? []

  return (
    <section id="forum" className="scroll-mt-20 border-t bg-card/60">
      <div className="container py-14">
        <SectionHeader
          eyebrow="Forum"
          title="博客论坛"
          action={
            authed ? (
              <Link
                to="/forum"
                className="group flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                进入论坛
              </Link>
            ) : undefined
          }
        />

        {!authed ? (
          <div className="flex flex-col items-start gap-5 rounded-xl border border-dashed bg-card p-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Lock className="size-4 text-muted-foreground" />
                论坛需要登录后参与
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                资讯、模型与研究报告对所有人开放; 发帖、评论这类需要署名的内容,
                登录后即可参与。
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Button asChild className="font-semibold">
                <Link to="/login" search={{ redirect: "/forum" }}>
                  登录 / 注册
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/news">先逛逛资讯</Link>
              </Button>
            </div>
          </div>
        ) : isPending ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                to="/forum/$postId"
                params={{ postId: String(post.id) }}
                className="group flex flex-col rounded-xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug tracking-tight transition-colors group-hover:text-primary">
                  {post.title}
                </h3>
                <p className="mt-2.5 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {post.excerpt}
                </p>
                <div className="mt-5 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">
                    {post.author_name}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">{formatDateTime(post.created_at)}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <MessageSquare className="size-3.5" />
                      {post.comment_count}
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card p-8 text-sm text-muted-foreground">
            论坛还没有帖子, 来做第一个发言的人。
            <Button asChild variant="outline" className="bg-page">
              <Link to="/forum">去发帖</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
