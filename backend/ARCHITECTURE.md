# ai-news-intelligence 架构文档

> 本文档描述 `ai-news-intelligence` 项目的整体架构、目录结构、模块职责和核心数据流。

## 1. 项目概述

`ai-news-intelligence` 是一个 AI 新闻情报系统，用于：

- 从多种来源（RSS、Web）采集新闻；
- 使用 AI 进行摘要、分类、实体识别和向量化；
- 提供新闻检索、趋势分析和个性化订阅能力；
- 通过 REST API 向用户或前端应用提供服务。

## 2. 技术栈（规划）

- **后端框架**：FastAPI
- **ORM**：SQLAlchemy + Alembic
- **数据库**：PostgreSQL / MySQL（可通过 SQLAlchemy 适配）
- **任务调度**：Celery / APScheduler（`tasks` 目录）
- **AI/ML**：LLM 摘要、分类、Embedding、Agent
- **爬虫**：RSS 解析、Web 抓取
- **部署**：Docker + docker-compose

## 3. 目录结构

```text
ai-news-intelligence/
│
├── app/
│   │
│   ├── main.py                     # FastAPI 应用入口
│   │
│   ├── core/
│   │   ├── config.py               # 全局配置
│   │   ├── security.py             # 安全工具（JWT、密码哈希等）
│   │   └── database.py             # 数据库连接与会话管理
│   │
│   ├── models/
│   │   ├── user.py                 # 用户模型
│   │   ├── refresh_token.py        # 刷新令牌模型
│   │   ├── news.py                 # 新闻模型
│   │   ├── source.py               # 新闻源模型
│   │   ├── category.py             # 分类模型
│   │   ├── tag.py                  # 标签模型
│   │   ├── entity.py               # 实体模型
│   │   └── subscription.py         # 订阅模型
│   │
│   ├── schemas/
│   │   ├── user.py                 # 用户 Pydantic Schema
│   │   ├── auth.py                 # 认证 Schema
│   │   ├── news.py                 # 新闻 Schema
│   │   ├── category.py             # 分类 Schema
│   │   └── search.py               # 搜索 Schema
│   │
│   ├── api/
│   │   ├── auth.py                 # 认证接口
│   │   ├── users.py                # 用户接口
│   │   ├── news.py                 # 新闻接口
│   │   ├── search.py               # 搜索接口
│   │   ├── trends.py               # 趋势接口
│   │   └── subscriptions.py        # 订阅接口
│   │
│   ├── services/
│   │   ├── auth_service.py         # 认证业务逻辑
│   │   ├── news_service.py         # 新闻业务逻辑
│   │   ├── ai_service.py           # AI 服务编排
│   │   ├── search_service.py       # 搜索业务逻辑
│   │   └── trend_service.py        # 趋势业务逻辑
│   │
│   ├── crawlers/
│   │   ├── base.py                 # 爬虫基类
│   │   ├── rss.py                  # RSS 爬虫
│   │   └── web.py                  # Web 爬虫
│   │
│   ├── ai/
│   │   ├── summarizer.py           # AI 摘要
│   │   ├── classifier.py           # AI 分类
│   │   ├── embedding.py            # 向量化/Embedding
│   │   └── agent.py                # AI Agent 智能体
│   │
│   └── tasks/
│       ├── crawl.py                # 定时抓取任务
│       ├── process_news.py         # 新闻处理任务
│       └── generate_trends.py      # 趋势生成任务
│
├── tests/                          # 单元/集成测试
├── alembic/                        # 数据库迁移脚本
├── Dockerfile                      # 后端镜像构建
├── docker-compose.yml              # 本地/生产编排
├── pyproject.toml                  # Python 项目依赖与配置
└── README.md                       # 项目说明
```

## 4. 分层架构说明

### 4.1 API 层（`app/api/`）

负责接收 HTTP 请求、参数校验、调用 Service 层并返回响应。

| 文件 | 职责 |
| --- | --- |
| `auth.py` | 登录、注册、刷新令牌、退出登录 |
| `users.py` | 用户资料查询与修改 |
| `news.py` | 新闻列表、详情、收藏/关联操作 |
| `search.py` | 关键词搜索、高级检索 |
| `trends.py` | 热门趋势、热度排行 |
| `subscriptions.py` | 订阅源、订阅分类/标签管理 |

### 4.2 Service 层（`app/services/`）

封装业务规则，协调 Model、AI、爬虫和任务模块，避免在 API 层堆积复杂逻辑。

### 4.3 数据模型层（`app/models/`）

使用 SQLAlchemy 定义数据库表结构，包含用户、令牌、新闻、来源、分类、标签、实体和订阅等核心实体。

### 4.4 Schema 层（`app/schemas/`）

使用 Pydantic 定义请求/响应数据结构，负责数据校验、序列化和 API 契约。

### 4.5 爬虫层（`app/crawlers/`）

- `base.py`：定义统一爬虫接口和通用工具；
- `rss.py`：解析 RSS/Atom 源；
- `web.py`：抓取普通网页并提取正文。

### 4.6 AI 层（`app/ai/`）

- `summarizer.py`：生成新闻摘要；
- `classifier.py`：对新闻分类/打标签；
- `embedding.py`：生成向量用于语义搜索；
- `agent.py`：基于 Agent 完成复杂情报分析/问答。

### 4.7 任务层（`app/tasks/`）

- `crawl.py`：定时调度爬虫抓取新闻；
- `process_news.py`：抓取后执行去重、清洗、AI 摘要、分类、Embedding；
- `generate_trends.py`：周期性聚合数据生成趋势。

## 5. 核心数据流

```text
[外部新闻源] -> [Crawlers] -> [Tasks/crawl]
                                    |
                                    v
                          [Tasks/process_news]
                                    |
                    +---------------+---------------+
                    |               |               |
                    v               v               v
              [AI Summarizer] [AI Classifier] [AI Embedding]
                    |               |               |
                    +-------+-------+---------------+
                            |
                            v
                     [Database/News]
                            |
                            v
                     [API/Service]
                            |
                            v
                 [Web/App 客户端]
```

流程说明：

1. 定时任务触发爬虫，从 RSS/Web 获取原始新闻；
2. 原始新闻进入处理任务，进行清洗、去重；
3. AI 模块生成摘要、分类、标签和向量；
4. 处理结果写入数据库；
5. 用户通过 API 查询新闻、搜索、订阅或查看趋势；
6. 趋势任务定期从新闻数据中聚合热点。

## 6. 关键设计考虑

- **关注点分离**：API、Service、Model、AI、Crawler、Task 各层独立，便于测试和维护。
- **异步处理**：爬取和 AI 处理放到后台任务，避免阻塞 API 请求。
- **可扩展数据源**：通过 `crawlers/base.py` 抽象，可方便新增 RSS、Web 或其他类型爬虫。
- **AI 能力模块化**：摘要、分类、Embedding、Agent 分开实现，可独立替换模型或服务。
- **数据库迁移**：使用 Alembic 管理 schema 变更。

## 7. 部署结构

```text
Dockerfile         -> 构建 FastAPI 应用镜像
docker-compose.yml -> 编排后端、数据库、任务队列等依赖服务
```

典型部署角色：

- **API 服务**：运行 `app/main.py`，对外提供 REST API；
- **Worker 服务**：运行 `app/tasks/` 中的异步任务；
- **数据库**：存储结构化业务数据；
- **消息队列/调度器**：支撑任务分发与定时执行。
