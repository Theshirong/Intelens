import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/layout/theme-toggle"

interface DocHeaderProps {
  /** 切换左侧资讯目录: 宽屏折叠 / 窄屏弹出抽屉 */
  onToggleNav: () => void
  sidebarOpen?: boolean
  /** 页头第二行内容 (面包屑等) */
  children?: ReactNode
}

/** 文档式页头: 首行为品牌, 次行为面包屑 (窄屏另带目录开关) */
export function DocHeader({ onToggleNav, sidebarOpen, children }: DocHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-page/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-[17px] leading-none"
          aria-label="Intelens 文档"
        >
          <span className="font-brand text-[17px]">Intelens</span>
          <span className="text-muted-foreground/40">|</span>
          <span className="font-medium text-muted-foreground">文档</span>
        </Link>

        {/* 阅读页没有全局导航, 日间/夜间切换就放在页头右侧 */}
        <ThemeToggle className="ml-auto" />
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-1.5 px-4 py-1 sm:px-6 lg:px-8">
          {/* 宽屏目录常驻, 开关只在窄屏需要 */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={onToggleNav}
            aria-label="打开资讯目录"
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
