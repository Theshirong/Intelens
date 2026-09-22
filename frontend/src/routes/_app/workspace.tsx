import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * 账户设置已改成悬浮弹窗 (见 components/settings/account-settings-dialog),
 * 不再有独立页面; 老地址直接回首页, 避免历史链接 404。
 */
export const Route = createFileRoute("/_app/workspace")({
  beforeLoad: () => {
    throw redirect({ to: "/" })
  },
  component: () => null,
})
