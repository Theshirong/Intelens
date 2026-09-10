import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router"
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

/** 文档式阅读页 (/news/:id) 自带页头与公告条, 再套全局导航会重复 */
const DOC_ROUTE = /^\/news\/[^/]+\/?$/

function AppLayout() {
  useMe()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (DOC_ROUTE.test(pathname)) {
    return (
      <div className="flex min-h-screen flex-col bg-card">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    )
  }

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
