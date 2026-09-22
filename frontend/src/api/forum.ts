import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type {
  ForumCommentItem,
  ForumPostDetail,
  ForumPostListItem,
  Page,
} from "@/types/api"

interface ForumPostsParams {
  page?: number
  pageSize?: number
  /** 标题/正文关键词 (全站搜索与列表页公用) */
  q?: string
  /** 首页预览等场景可以先不请求 (未登录时留空) */
  enabled?: boolean
}

/** 帖子列表 (论坛接口需要登录) */
export function useForumPosts({
  page = 1,
  pageSize = 20,
  q,
  enabled = true,
}: ForumPostsParams = {}) {
  return useQuery({
    queryKey: ["forum", "posts", page, pageSize, q ?? ""],
    queryFn: () =>
      api<Page<ForumPostListItem>>("/forum/posts", {
        params: { page, page_size: pageSize, q: q?.trim() || undefined },
      }),
    enabled,
    placeholderData: (prev) => prev,
  })
}

/** 帖子详情 (含正文与评论) */
export function useForumPost(id: number, enabled = true) {
  return useQuery({
    queryKey: ["forum", "post", id],
    queryFn: () => api<ForumPostDetail>(`/forum/posts/${id}`),
    enabled: enabled && Number.isFinite(id),
    retry: false,
  })
}

export function useCreateForumPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; content: string }) =>
      api<ForumPostListItem>("/forum/posts", { method: "POST", body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forum"] })
    },
  })
}

export function useDeleteForumPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api<{ msg: string }>(`/forum/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forum"] })
    },
  })
}

export function useCreateForumComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, content }: { postId: number; content: string }) =>
      api<ForumCommentItem>(`/forum/posts/${postId}/comments`, {
        method: "POST",
        body: { content },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forum"] })
    },
  })
}

export function useDeleteForumComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: number) =>
      api<{ msg: string }>(`/forum/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forum"] })
    },
  })
}
