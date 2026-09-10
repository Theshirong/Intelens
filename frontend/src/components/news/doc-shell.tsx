import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

interface DocHeaderProps {
  /** 切换左侧资讯目录: 宽屏折叠 / 窄屏弹出抽屉 */
  onToggleNav: () => void
  sidebarOpen?: boolean
  /** 页头第二行内容 (面包屑等) */
  children?: ReactNode
}

/** 文档式页头: 首行为品牌 + 主题切换, 次行为目录开关 + 面包屑 */
export function DocHeader({ onToggleNav, sidebarOpen, children }: DocHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-[17px] leading-none"
          aria-label="NEXUS AI NEWS 文档"
        >
          <span className="font-medium tracking-tight text-muted-foreground">
            Nexus
          </span>
          <span className="font-display font-black tracking-tight">AI NEWS</span>
          <span className="text-muted-foreground/40">|</span>
          <span className="font-medium text-muted-foreground">文档</span>
        </Link>

        <ThemeToggle className="ml-auto" />
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-1.5 px-4 py-1 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onToggleNav}
            aria-label={sidebarOpen ? "收起资讯目录" : "打开资讯目录"}
            aria-expanded={sidebarOpen}
          >
            <PanelLeft className="size-[18px]" />
          </Button>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </header>
  )
}
