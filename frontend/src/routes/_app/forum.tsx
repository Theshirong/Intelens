import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { useAuthStore } from "@/stores/auth"

/**
 * 博客论坛是站内唯一要求登录的区域:
 * 未登录先送去登录页, 并把当前地址带上, 登录后原地返回。
 */
export const Route = createFileRoute("/_app/forum")({
  beforeLoad: ({ location }) => {
    if (!useAuthStore.getState().accessToken) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      })
    }
  },
  component: () => (
    <div className="container py-10 lg:py-12">
      <Outlet />
    </div>
  ),
})
