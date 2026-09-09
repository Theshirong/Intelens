import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { UserResponse } from "@/types/api"

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserResponse | null
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: UserResponse | null) => void
  clear: () => void
}

/** 认证状态, 持久化到 localStorage */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "intelens-auth" },
  ),
)
