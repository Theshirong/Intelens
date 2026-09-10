export interface MarkdownHeading {
  id: string
  level: 2 | 3
  text: string
}

function headingText(value: string) {
  return value
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/[*_~]/g, "")
    .replace(/\\([\\`*_[]{}()#+.!-])/g, "$1")
    .trim()
}

function slugify(value: string) {
  const slug = value
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "section"
}

/** Extract the headings rendered in the article's table of contents. */
export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  const usedIds = new Map<string, number>()
  let inFence = false

  for (const line of markdown.split("\n")) {
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = line.match(/^\s{0,3}(#{2,3})\s+(.+?)\s*#*\s*$/)
    if (!match) continue
    const text = headingText(match[2])
    if (!text) continue

    const baseId = slugify(text)
    const count = (usedIds.get(baseId) ?? 0) + 1
    usedIds.set(baseId, count)
    headings.push({
      id: count === 1 ? baseId : `${baseId}-${count}`,
      level: match[1].length as 2 | 3,
      text,
    })
  }

  return headings
}
