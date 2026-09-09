/** 后端 OpenAPI 对应的类型定义 (backend/app/schemas) */

export interface UserResponse {
  id: number
  username: string
  role: string
  created_at: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  msg: string
}

export interface NewsListItem {
  id: number
  title: string
  url: string
  published_at: string | null
  source_id: number
  source_name: string
}

export interface NewsDetail extends NewsListItem {
  content: string | null
  fetched_at: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}
