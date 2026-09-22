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

/** 模型架构 (OpenRouter 原样, 见 /api/v1/models) */
export interface ModelArchitecture {
  modality: string
  input_modalities: string[]
  output_modalities: string[]
  tokenizer?: string | null
  instruct_type?: string | null
}

/** 主要服务商 (OpenRouter 原样): 自营渠道实际提供的窗口与最大输出 */
export interface ModelTopProvider {
  context_length: number | null
  max_completion_tokens: number | null
  is_moderated?: boolean
}

/** 基准测试 (OpenRouter 原样): 能力维度取 artificial_analysis 的三个指数 */
export interface ModelBenchmarks {
  artificial_analysis?: {
    intelligence_index: number | null
    coding_index: number | null
    agentic_index: number | null
  } | null
  design_arena?: unknown[]
}

/**
 * 模型 (OpenRouter 模型对象原样 + 后端派生的价格)
 *
 * 嵌套字段是 OpenRouter 的原始结构; price_* 与 price_notes 是后端按
 * 「美元/百万 tokens、空闲/高峰」算出来的展示值, 库里不存。
 */
export interface ModelListItem {
  id: number
  api_name: string
  company: string
  canonical_slug: string | null
  name: string | null
  created: string | null
  context_length: number | null
  architecture: ModelArchitecture | null
  pricing: Record<string, unknown> | null
  top_provider: ModelTopProvider | null
  per_request_limits: Record<string, unknown> | null
  supported_parameters: string[] | null
  default_parameters: Record<string, unknown> | null
  supported_voices: string[] | null
  knowledge_cutoff: string | null
  expiration_date: string | null
  benchmarks: ModelBenchmarks | null
  price_input_hit_idle: number | null
  price_input_miss_idle: number | null
  price_output_idle: number | null
  price_input_hit_peak: number | null
  price_input_miss_peak: number | null
  price_output_peak: number | null
  /** 计价规则说明 (峰谷时段、长上下文加价), 每项一条 */
  price_notes: string[]
  fetched_at: string
}

export interface PriceHistoryItem {
  captured_on: string
  price_input_hit_idle: number | null
  price_input_miss_idle: number | null
  price_output_idle: number | null
}

/**
 * OpenRouter 周榜的一行 (一个模型某天的位次快照)
 *
 * 接口只给排序不给热度数值, 所以这里只有位次: rank 越小越热。名次是相对量,
 * 只在同期内可比, 跨期看的是涨落而不是绝对值。
 */
export interface ModelPopularityItem {
  model_id: number
  source: string
  rank: number
  captured_on: string
}

/* ---------------- 博客论坛 ---------------- */

export interface ForumCommentItem {
  id: number
  post_id: number
  author_id: number
  author_name: string
  content: string
  created_at: string
}

export interface ForumPostListItem {
  id: number
  title: string
  excerpt: string
  author_id: number
  author_name: string
  created_at: string
  updated_at: string
  comment_count: number
}

export interface ForumPostDetail extends ForumPostListItem {
  content: string
  comments: ForumCommentItem[]
}
