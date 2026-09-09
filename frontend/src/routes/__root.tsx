import { createRootRouteWithContext } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { Outlet } from "@tanstack/react-router"

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster position="top-center" richColors />
    </>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-6xl font-black tracking-tight">404</p>
      <p className="text-muted-foreground">页面不存在</p>
      <a href="/" className="text-primary underline-offset-4 hover:underline">
        返回首页
      </a>
    </div>
  ),
})
