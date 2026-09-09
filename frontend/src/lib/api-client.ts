import { useAuthStore } from "@/stores/auth"

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1"

/** 后端统一错误: FastAPI HTTPException 的 { detail } */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  params?: Record<string, string | number | undefined | null>
}

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const data = await res.json()
    const detail = data?.detail
    if (typeof detail === "string") return new ApiError(res.status, detail)
    // 422 校验错误: [{loc, msg}]
    if (Array.isArray(detail)) {
      const first = detail[0]
      const field = Array.isArray(first?.loc) ? first.loc.at(-1) : ""
      return new ApiError(res.status, `${field ? `${field}: ` : ""}${first?.msg ?? "参数错误"}`)
    }
  } catch {
    // 非 JSON 响应, 走默认消息
  }
  return new ApiError(res.status, `请求失败 (${res.status})`)
}

/** 用 refresh_token 换新 token */
async function doRefresh(): Promise<boolean> {
  const { refreshToken, setTokens } = useAuthStore.getState()
  if (!refreshToken) return false
  try {
    const res = await fetch(buildUrl("/users/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    const data = await res.json()
    setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    return false
  }
}

// 单飞: 并发 401 时只发起一次 refresh
let refreshInFlight: Promise<boolean> | null = null
function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

/**
 * 带认证的请求封装:
 * - 自动附带 Bearer token
 * - 401 时自动 refresh 并重试一次
 * - refresh 失败则清空登录态并跳转登录页
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params } = options

  const doFetch = () => {
    const { accessToken } = useAuthStore.getState()
    return fetch(buildUrl(path, params), {
      method,
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  }

  // 请求是否携带了 token: 登录/注册等匿名请求的 401 是真实的凭据错误,
  // 不应触发 refresh 重试
  const hadToken = Boolean(useAuthStore.getState().accessToken)

  let res = await doFetch()

  if (res.status === 401 && hadToken) {
    const refreshed = await refreshOnce()
    if (refreshed) {
      res = await doFetch()
    } else {
      useAuthStore.getState().clear()
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login")
      }
      throw new ApiError(401, "登录已过期, 请重新登录")
    }
  }

  if (!res.ok) throw await parseError(res)

  // 204 / 空 body
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
