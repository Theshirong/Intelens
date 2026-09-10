import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface BackToTopProps {
  /** 滚动超过该距离后显示按钮 */
  threshold?: number
}

/** 阅读页右下角的「回到顶部」按钮, 向下滚动一段距离后淡入。 */
export function BackToTop({ threshold = 400 }: BackToTopProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        setVisible(window.scrollY > threshold)
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [threshold])

  const handleClick = () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="回到顶部"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "fixed bottom-8 right-4 z-40 flex size-11 items-center justify-center rounded-full border bg-card text-foreground shadow-md transition-all duration-200 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-6",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  )
}
