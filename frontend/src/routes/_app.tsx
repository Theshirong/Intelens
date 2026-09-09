import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { useMe } from "@/api/auth"
import { useAuthStore } from "@/stores/auth"
import { Footer, ScrollToHash, TopNav } from "@/components/layout/site-chrome"

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    // 新闻等接口均需登录, 未登录直接送往登录页
    if (!useAuthStore.getState().accessToken) {
      throw redirect({ to: "/login" })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  useMe()

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ScrollToHash />
    </div>
  )
}
