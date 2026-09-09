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
    mutationFn: (userId: number) => api<{ msg: string }>(`/admin/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
  })
}
