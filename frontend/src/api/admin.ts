import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Page, UserResponse } from "@/types/api"

export function useAllUsers(page: number, pageSize: number) {
  return useQuery({
    queryKey: ["admin", "users", page, pageSize],
    queryFn: () =>
      api<Page<UserResponse>>("/admin/users_all", {
        params: { page, page_size: pageSize },
      }),
    placeholderData: (prev) => prev,
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    // 后端要求管理员密码二次确认, 密码错误时返回 400「密码错误」
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      api<{ msg: string }>(`/admin/${userId}`, {
        method: "DELETE",
        body: { password },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
  })
}
