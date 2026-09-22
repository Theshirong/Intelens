import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { useAuthStore } from "@/stores/auth"
import type { LoginResponse, UserResponse } from "@/types/api"

/** 当前用户信息 */
export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const user = await api<UserResponse>("/users/me")
      useAuthStore.getState().setUser(user)
      return user
    },
    // 未登录的访客不请求 /users/me, 避免必现的 401
    enabled: Boolean(accessToken),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      api<LoginResponse>("/users/login", { method: "POST", body: data }),
    onSuccess: (data) => {
      useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
      void queryClient.invalidateQueries()
    },
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: { username: string; password: string; password_confirm: string }) =>
      api<UserResponse>("/users/register", { method: "POST", body: data }),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: () => {
      const { refreshToken } = useAuthStore.getState()
      return api<{ msg: string }>("/users/logout", {
        method: "POST",
        body: { refresh_token: refreshToken },
      })
    },
    onSettled: () => {
      useAuthStore.getState().clear()
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { old_password: string; new_password: string }) =>
      api<{ msg: string }>("/users/me/password", { method: "PATCH", body: data }),
  })
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string) =>
      api<{ msg: string }>("/users/me", { method: "DELETE", body: { password } }),
    onSettled: () => {
      useAuthStore.getState().clear()
    },
  })
}

/** 修改自己的信息 (目前只有用户名) */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { username: string }) =>
      api<UserResponse>("/users/me", { method: "PATCH", body: data }),
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user)
      // 顶栏/设置侧栏读的是 /me, 论坛帖子与评论显示的是作者名, 都要跟着刷新
      void queryClient.invalidateQueries({ queryKey: ["me"] })
      void queryClient.invalidateQueries({ queryKey: ["forum"] })
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
  })
}
