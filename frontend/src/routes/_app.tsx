import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router"
import { useMe } from "@/api/auth"
import { Footer, ScrollToHash, TopNav } from "@/components/layout/site-chrome"
import { AccountSettingsDialog } from "@/components/settings/account-settings-dialog"

export const Route = createFileRoute("/_app")({
  component: AppLayout,
})

/** 文档式阅读页 (/news/:id) 自带页头与公告条, 再套全局导航会重复 */
const DOC_ROUTE = /^\/news\/[^/]+\/?$/

function AppLayout() {
  useMe()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (DOC_ROUTE.test(pathname)) {
    return (
      <div className="flex min-h-screen flex-col bg-page">
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
      {/* 账户设置悬浮在任意页面上, 不占路由 */}
      <AccountSettingsDialog />
    </div>
  )
}
