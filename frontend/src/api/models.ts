import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type {
  ModelListItem,
  ModelPopularityItem,
  PriceHistoryItem,
} from "@/types/api"

export function useModelList(q?: string) {
  return useQuery({
    queryKey: ["models", "list", q ?? ""],
    queryFn: () =>
      api<ModelListItem[]>("/models", { params: { q: q?.trim() || undefined } }),
    // 模型信息一天才采集一轮, 没必要频繁重取
    staleTime: 10 * 60 * 1000,
  })
}

export function usePriceHistory(modelId: number) {
  return useQuery({
    queryKey: ["models", "price-history", modelId],
    queryFn: () => api<PriceHistoryItem[]>(`/models/${modelId}/price-history`),
    enabled: Number.isFinite(modelId),
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * 热度名次快照 (OpenRouter 周榜)
 *
 * 榜单按近一周的 token 量排序, 我们按天存位次: 一条线上看到的是「爬榜 / 掉榜」。
 * 榜外的日期没有数据点, 曲线断开。
 */
export function usePopularityHistory(days = 30) {
  return useQuery({
    queryKey: ["models", "popularity", days],
    queryFn: () =>
      api<ModelPopularityItem[]>("/models/popularity-history", {
        params: { days },
      }),
    staleTime: 10 * 60 * 1000,
  })
}
