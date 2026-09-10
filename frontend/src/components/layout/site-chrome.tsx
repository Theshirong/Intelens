import { useEffect } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useRouterState } from "@tanstack/react-router"
import { useState } from "react"
import { Newspaper, Search, LogOut, LayoutDashboard, Menu } from "lucide-react"
import { useMe, useLogout } from "@/api/auth"
import { useAuthStore } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { label: "首页", to: "/", hash: undefined },
  { label: "最新资讯", to: "/news", hash: undefined },
  { label: "模型动态", to: "/", hash: "model-watch" },
  { label: "行业研究", to: "/", hash: "insight" },
  { label: "数据中心", to: "/", hash: "trend-map" },
] as const

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-md bg-foreground font-display text-lg font-black text-background">
        N
      </span>
      <span className="font-display text-base font-black tracking-tight">
        NEXUS AI NEWS
      </span>
    </Link>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.label}
          to={link.to}
          hash={link.hash}
          onClick={onNavigate}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </>
  )
}

/** 顶部导航 */
export function TopNav() {
  const navigate = useNavigate()
  const { data: user } = useMe()
  const accessToken = useAuthStore((s) => s.accessToken)
  const logout = useLogout()
  const [mobileOpen, setMobileOpen] = useState(false)

  const authed = Boolean(accessToken)

  const handleLogout = () =>
    logout.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(data.msg)
        void navigate({ to: "/login" })
      },
    })

  return (
    <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-6">
        <Logo />

        <nav className="hidden items-center gap-7 md:flex">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="搜索资讯"
            onClick={() => void navigate({ to: "/news" })}
          >
            <Search className="size-4" />
          </Button>

          {authed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-secondary"
                  aria-label="用户菜单"
                >
                  <Avatar className="size-8 border">
                    <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
                      {(user?.username ?? "U").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">
                    {user?.username ?? "已登录"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{user?.username}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {user?.role === "admin" ? "管理员" : "成员"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void navigate({ to: "/workspace" })}>
                  <LayoutDashboard className="size-4" />
                  工作台
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="size-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild className="font-semibold">
              <Link to="/login">
                <Newspaper className="size-4" />
                进入工作台
              </Link>
            </Button>
          )}

          {/* 移动端菜单 */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="打开菜单">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-display font-black">
                  <Newspaper className="size-4" /> NEXUS AI NEWS
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
                <div className="my-2 h-px bg-border" />
                {authed ? (
                  <>
                    <Link
                      to="/workspace"
                      onClick={() => setMobileOpen(false)}
                      className={cn("rounded-md px-2 py-2 text-sm font-medium hover:bg-secondary")}
                    >
                      工作台
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="rounded-md px-2 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      退出登录
                    </button>
                  </>
                ) : (
                  <Button asChild className="mt-2 font-semibold">
                    <Link to="/login" onClick={() => setMobileOpen(false)}>
                      进入工作台
                    </Link>
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

/** 页脚 */
export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container flex flex-col items-center justify-between gap-3 py-8 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-md bg-foreground font-display text-sm font-black text-background">
            N
          </span>
          <div>
            <div className="font-display text-sm font-black tracking-tight">NEXUS AI NEWS</div>
            <div className="text-xs text-muted-foreground">AI 新闻情报 · 研究 · 洞察</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Newspaper className="size-3.5" />
          让 AI 发现更多可能
        </div>
      </div>
    </footer>
  )
}

/** 支持 /#section 锚点平滑滚动 (跨页跳转后生效) */
export function ScrollToHash() {
  const hash = useRouterState({ select: (s) => s.location.hash })
  useEffect(() => {
    if (!hash) return
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [hash])
  return null
}
