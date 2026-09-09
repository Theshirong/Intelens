import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { useAuthStore } from "@/stores/auth"
import type { LoginResponse, UserResponse } from "@/types/api"

/** 当前用户信息 */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const user = await api<UserResponse>("/users/me")
      useAuthStore.getState().setUser(user)
      return user
    },
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
