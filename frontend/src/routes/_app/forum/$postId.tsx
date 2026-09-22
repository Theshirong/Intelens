import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import Markdown from "react-markdown"
import { toast } from "sonner"
import { ArrowLeft, FileQuestion, MessageSquare, ShieldAlert, Trash2 } from "lucide-react"
import {
  useCreateForumComment,
  useDeleteForumComment,
  useDeleteForumPost,
  useForumPost,
} from "@/api/forum"
import { useMe } from "@/api/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { BackHome } from "@/components/layout/back-home"
import { formatFullDateTime } from "@/lib/format"

export const Route = createFileRoute("/_app/forum/$postId")({
  component: ForumPostPage,
})

/** 圆形首字头像: 论坛里没有昵称, 用用户名首字母 */
function AuthorAvatar({ name }: { name: string }) {
  return (
    <Avatar className="size-8 border">
      <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
        {name.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

function PostLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

function ForumPostPage() {
  const { postId } = Route.useParams()
  const navigate = useNavigate()
  const id = Number(postId)
  const { data: user } = useMe()
  const { data: post, isPending, isError } = useForumPost(id)
  const createComment = useCreateForumComment()
  const deleteComment = useDeleteForumComment()
  const deletePost = useDeleteForumPost()
  const [comment, setComment] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  // 作者本人或管理员可以删除
  const canManage = (authorId: number) =>
    Boolean(user && (user.id === authorId || user.role === "admin"))

  const submitComment = (event: React.FormEvent) => {
    event.preventDefault()
    if (!comment.trim()) return
    createComment.mutate(
      { postId: id, content: comment.trim() },
      {
        onSuccess: () => {
          setComment("")
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  const handleDeletePost = () => {
    deletePost.mutate(id, {
      onSuccess: (res) => {
        toast.success(res.msg)
        void navigate({ to: "/forum" })
      },
      onError: (err) => toast.error(err.message),
    })
  }

  if (isPending) return <PostLoading />

  if (isError || !post) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
        <FileQuestion className="size-10" />
        <p className="font-medium">帖子不存在或已删除</p>
        <Link
          to="/forum"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          返回论坛
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-4">
        <BackHome />
        <Link
          to="/forum"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          返回论坛
        </Link>
      </div>

      <article className="mt-5">
        <h1 className="font-display text-2xl font-black leading-snug tracking-tight sm:text-3xl">
          {post.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <AuthorAvatar name={post.author_name} />
            <span className="text-sm font-medium text-foreground/80">
              {post.author_name}
            </span>
          </span>
          <span className="tabular-nums">发布于 {formatFullDateTime(post.created_at)}</span>
          <span className="flex items-center gap-1 tabular-nums">
            <MessageSquare className="size-3.5" />
            {post.comment_count}
          </span>
          {canManage(post.author_id) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
              删除
            </Button>
          )}
        </div>

        <Separator className="my-6" />

        <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-img:rounded-lg">
          <Markdown>{post.content}</Markdown>
        </div>
      </article>

      <Separator className="my-8" />

      <section>
        <h2 className="flex items-center gap-2 text-base font-bold">
          <MessageSquare className="size-4" />
          评论
          <span className="tabular-nums text-muted-foreground">
            {post.comment_count}
          </span>
        </h2>

        <div className="mt-4 space-y-3">
          {post.comments.length > 0 ? (
            post.comments.map((item) => (
              <Card key={item.id} className="bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AuthorAvatar name={item.author_name} />
                    <span className="text-sm font-medium text-foreground/80">
                      {item.author_name}
                    </span>
                    <span className="tabular-nums">{formatFullDateTime(item.created_at)}</span>
                    {canManage(item.author_id) && (
                      <button
                        type="button"
                        className="ml-auto rounded p-1 transition-colors hover:text-destructive"
                        aria-label="删除评论"
                        onClick={() =>
                          deleteComment.mutate(item.id, {
                            onSuccess: (res) => toast.success(res.msg),
                            onError: (err) => toast.error(err.message),
                          })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {item.content}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">还没有评论, 说说你的看法</p>
          )}
        </div>

        <form onSubmit={submitComment} className="mt-5 space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="写下你的评论… (Ctrl / ⌘ + Enter 快速发送)"
            maxLength={2000}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault()
                submitComment(e)
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={createComment.isPending || !comment.trim()}
            >
              {createComment.isPending ? "发送中…" : "发表评论"}
            </Button>
          </div>
        </form>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-destructive" />
              删除帖子
            </DialogTitle>
            <DialogDescription>
              帖子及其全部评论会被永久删除, 该操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deletePost.isPending}
              onClick={handleDeletePost}
            >
              {deletePost.isPending ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
