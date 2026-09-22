import { Link } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

/** 页面左上角的返回入口, 与厂商/模型页保持一致 */
export function BackHome({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary",
        className,
      )}
    >
      <ChevronLeft className="size-4" />
      返回首页
    </Link>
  )
}
