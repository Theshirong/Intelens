import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface HeroFaceProps {
  className?: string
}

/** 眼睛在 32×32 viewBox 中的中心, 眨眼围绕它缩放 */
const EYES_CENTER = { x: 16, y: 14 }
/** 光标进入这个半径(px)内, 圆脸开始看过去 */
const INFLUENCE = 320
/** 眼珠最大偏移 (viewBox 单位); 纵向收窄一些, 免得眼睛顶出脸边 */
const MAX_SHIFT_X = 6
const MAX_SHIFT_Y = 3.6
/** 越小越慢, 眼睛移动更从容 */
const EASE = 0.085
/** 眨眼一次的时长(ms) */
const BLINK_MS = 170

/**
 * 闲置时主动张望的方向, 依次扫过且不会停在正中
 * (一直回中会很呆, 所以这里没有中心点)
 */
const GAZE_POINTS = [
  { x: -5.6, y: -0.6 },
  { x: 4.6, y: -2.6 },
  { x: 5.4, y: 1.8 },
  { x: -2.6, y: -3.2 },
  { x: 0.8, y: 3.0 },
  { x: -4.4, y: 2.4 },
] as const

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * 带两只眼睛的圆脸:
 * 圆脸与眼珠分别跟随前景/背景色 (和文字一样随主题反转),
 * 光标靠近时眼睛看向光标, 平时主动向四周张望并偶尔眨眼。
 */
export function HeroFace({ className }: HeroFaceProps) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const eyesRef = useRef<SVGGElement>(null)
  const blinkRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const eyes = eyesRef.current
    const blink = blinkRef.current
    if (!wrap || !eyes || !blink) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let pointerNear = false
    let gazeIndex = 0
    let frame = 0
    let blinkStart = 0
    let blinkEnd = 0
    let gazeTimer = 0
    let blinkTimer = 0

    const draw = () => {
      eyes.setAttribute(
        "transform",
        `translate(${current.x.toFixed(3)} ${current.y.toFixed(3)})`,
      )

      const now = performance.now()
      if (now < blinkEnd) {
        const progress = (now - blinkStart) / (blinkEnd - blinkStart)
        const squash = 1 - 0.82 * Math.sin(Math.PI * progress)
        blink.setAttribute(
          "transform",
          `translate(${EYES_CENTER.x} ${EYES_CENTER.y}) scale(1 ${squash.toFixed(3)}) translate(${-EYES_CENTER.x} ${-EYES_CENTER.y})`,
        )
      } else {
        blink.setAttribute("transform", "")
      }
    }

    const step = () => {
      frame = 0
      current.x += (target.x - current.x) * EASE
      current.y += (target.y - current.y) * EASE

      const settledX = Math.abs(target.x - current.x) < 0.02
      const settledY = Math.abs(target.y - current.y) < 0.02
      if (settledX) current.x = target.x
      if (settledY) current.y = target.y

      draw()

      if (!settledX || !settledY || performance.now() < blinkEnd) {
        frame = window.requestAnimationFrame(step)
      }
    }

    const wake = () => {
      if (!frame) frame = window.requestAnimationFrame(step)
    }

    const lookAt = (x: number, y: number) => {
      target.x = x
      target.y = y
      wake()
    }

    /** 挪到下一个张望方向 (偶尔连着同一个方向, 看起来更随意) */
    const gazeNext = () => {
      gazeIndex = (gazeIndex + 1 + Math.floor(Math.random() * 2)) % GAZE_POINTS.length
      const gaze = GAZE_POINTS[gazeIndex]
      lookAt(gaze.x, gaze.y)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect()
      if (rect.width === 0) return

      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      const distance = Math.hypot(dx, dy)

      const near = distance <= INFLUENCE
      if (!near || distance < 1) {
        // 离开影响范围后接着自己张望, 而不是僵在正中
        if (pointerNear) gazeNext()
        pointerNear = false
        return
      }

      pointerNear = true
      // 越靠近看得越用力, 刚进入影响范围时只轻轻瞟一眼
      const closeness = Math.min(1, 1 - distance / INFLUENCE)
      const amount = MAX_SHIFT_X * Math.min(1, 0.3 + closeness * 0.9)
      lookAt(
        clamp((dx / distance) * amount, -MAX_SHIFT_X, MAX_SHIFT_X),
        clamp((dy / distance) * amount, -MAX_SHIFT_Y, MAX_SHIFT_Y),
      )
    }

    const onPointerOut = (event: PointerEvent) => {
      // relatedTarget 为空说明光标离开了窗口
      if (event.relatedTarget) return
      if (pointerNear) gazeNext()
      pointerNear = false
    }

    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(() => {
        blinkStart = performance.now()
        blinkEnd = blinkStart + BLINK_MS
        wake()
        scheduleBlink()
      }, 2600 + Math.random() * 3200)
    }

    const scheduleGaze = (delay: number) => {
      gazeTimer = window.setTimeout(() => {
        if (!pointerNear) gazeNext()
        scheduleGaze(1400 + Math.random() * 1800)
      }, delay)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerout", onPointerOut)
    if (!reduced) {
      scheduleBlink()
      // 首帧别停在正中太久
      scheduleGaze(500)
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerout", onPointerOut)
      window.clearTimeout(blinkTimer)
      window.clearTimeout(gazeTimer)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <span ref={wrapRef} aria-hidden className={cn("hero-face", className)}>
      <svg viewBox="0 0 32 32" className="size-full">
        <circle cx="16" cy="16" r="15.5" className="fill-foreground" />
        <g ref={eyesRef}>
          <g ref={blinkRef}>
            <rect
              x="9.55"
              y="10.8"
              width="3.7"
              height="6.4"
              rx="1.85"
              ry="3.2"
              className="fill-background"
            />
            <rect
              x="18.75"
              y="10.8"
              width="3.7"
              height="6.4"
              rx="1.85"
              ry="3.2"
              className="fill-background"
            />
          </g>
        </g>
      </svg>
    </span>
  )
}
