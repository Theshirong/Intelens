import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
}

/**
 * 日间 / 夜间模式开关。
 * 只在两种模式之间切换 (不含「跟随系统」): 这里的语义就是
 * 「把当前页面调亮或调暗」, 点一下立即生效。
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // 首帧还不知道解析结果, 挂载后再渲染对应图标, 避免图标闪一下
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"
  const label = isDark ? "切换到日间模式" : "切换到夜间模式"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("shrink-0 text-muted-foreground hover:text-foreground", className)}
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
