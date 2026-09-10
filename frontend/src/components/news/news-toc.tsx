import { useEffect, useState, type MouseEvent } from "react"
import { cn } from "@/lib/utils"
import type { MarkdownHeading } from "./markdown-headings"

interface NewsTocProps {
  headings: MarkdownHeading[]
}

export function NewsToc({ headings }: NewsTocProps) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "")

  useEffect(() => {
    setActiveId(headings[0]?.id ?? "")
    if (headings.length === 0) return

    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null)
    if (elements.length === 0) return

    const updateActive = () => {
      // 页头两行吸顶, 判定线要落在其下方
      const threshold = 124
      let current = elements[0].id
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= threshold) current = element.id
      }
      setActiveId((previous) => (previous === current ? previous : current))
    }

    updateActive()
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        updateActive()
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [headings])

  if (headings.length === 0) return null

  const handleClick = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const target = document.getElementById(id)
    if (!target) return
    setActiveId(id)
    window.history.replaceState(null, "", `#${id}`)
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    })
  }

  return (
    <nav aria-label="文章目录" className="rounded-lg border-l-2 border-border pl-4">
      <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">目录</p>
      <ol className="space-y-1">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={handleClick(heading.id)}
              aria-current={activeId === heading.id ? "location" : undefined}
              className={cn(
                "block break-words border-l-2 border-transparent py-1 text-xs leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                heading.level === 3 && "pl-3",
                activeId === heading.id && "-ml-[18px] border-primary pl-4 font-semibold text-primary",
                activeId === heading.id && heading.level === 3 && "pl-7",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
