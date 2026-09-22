import { cn } from "@/lib/utils"

/**
 * 可直接播放的视频文件后缀。
 *
 * 抓取侧把 <video> 降级成 markdown 链接 (见 backend/app/crawlers/mimo.py),
 * 前端在这里还原成播放器; 媒体仍是站方 CDN 的外链, 不镜像、不落盘。
 */
const VIDEO_PATTERN = /\.(mp4|webm|ogv|mov)(?:[?#].*)?$/i

/** 判断链接是否指向可直接播放的视频文件 */
export function isVideoUrl(url: string | undefined): url is string {
  return typeof url === "string" && VIDEO_PATTERN.test(url)
}

/** 正文里的视频: 用原生播放器渲染, 避免把第三方 HTML 直接插进 DOM */
export function MarkdownVideo({
  src,
  className,
}: {
  src: string
  className?: string
}) {
  return (
    <video
      controls
      playsInline
      preload="metadata"
      src={src}
      className={cn("my-6 w-full rounded-lg border bg-black", className)}
    />
  )
}
