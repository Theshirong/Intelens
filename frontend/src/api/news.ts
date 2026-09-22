import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { NewsDetail, NewsListItem, Page } from "@/types/api"

export interface NewsListParams {
  page: number
  pageSize: number
  sourceId?: number | null
  /** 标题关键词 (全站搜索与列表页公用) */
  q?: string
}

export function useNewsList({ page, pageSize, sourceId, q }: NewsListParams) {
  return useQuery({
    queryKey: ["news", "list", page, pageSize, sourceId ?? "all", q ?? ""],
    queryFn: () =>
      api<Page<NewsListItem>>("/news", {
        params: {
          page,
          page_size: pageSize,
          source_id: sourceId ?? undefined,
          q: q?.trim() || undefined,
        },
      }),
    placeholderData: (prev) => prev, // 翻页时保持上一帧, 不闪骨架屏
  })
}

export function useNewsDetail(id: number) {
  return useQuery({
    queryKey: ["news", "detail", id],
    queryFn: () => api<NewsDetail>(`/news/${id}`),
    enabled: Number.isFinite(id),
    retry: false,
  })
}
