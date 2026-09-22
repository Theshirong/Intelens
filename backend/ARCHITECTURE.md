# Intelens 架构文档

> 本文档描述 `Intelens` 后端的**现状架构**（as-built）：目录结构、分层职责、认证设计与核心数据流。尚未实现、仅存在于规划中的模块以「规划」标注，演进路线与排期见 [docs/development-plan.md](docs/development-plan.md)。

## 1. 项目概述

`Intelens` 是一个 AI 新闻情报系统，仓库为前后端 monorepo：

- `backend/`：本服务，FastAPI，负责数据采集、AI 处理（规划）与 REST API；
- `frontend/`：React SPA（TanStack Router），消费 `/api/v1` 接口。

后端当前能力：

- 用户认证（JWT 双 token + 吊销/轮换）与管理员用户管理；
- 从官方渠道采集**新闻**（HTML 正文转 markdown 入库）；**模型信息**取自 OpenRouter 的公开模型目录（只收录各厂热门型号，字段与价格原样入库），定时任务驱动；
- 新闻与模型信息的查询接口。

## 2. 技术栈

| 项 | 现状 | 规划 |
| --- | --- | --- |
| 运行时 | Python 3.14，uv 管理依赖 | — |
| Web 框架 | FastAPI | — |
| ORM / 迁移 | SQLAlchemy 2（async）+ Alembic | — |
| 数据库 | SQLite（aiosqlite 驱动，`DATABASE_URL` 可切换） | PostgreSQL（asyncpg） |
| 任务调度 | APScheduler（随 API 进程常驻） | 任务变重时评估拆分独立 worker |
| 爬虫 | httpx + lxml + markdownify | RSS 解析、通用正文抽取 |
| AI | 未接入 | LLM 摘要 / 分类 / Embedding / Agent |
| 安全 | pwdlib（argon2）+ PyJWT | 限流、CORS 白名单 |
| 日志 | loguru | 结构化落盘 |
| 部署 | 本地 uv 运行 | Docker + docker-compose |

## 3. 目录结构

```text
backend/
│
├── app/
│   ├── main.py                     # FastAPI 入口: lifespan 创建初始管理员并启动采集调度
│   │
│   ├── core/
│   │   ├── config.py               # pydantic-settings 全局配置 (.env)
│   │   ├── security.py             # 密码哈希 (argon2) 与 JWT 签发/校验
│   │   └── database.py             # async engine、Base、get_db 会话依赖 (yield 后统一 commit)
│   │
│   ├── models/                     # SQLAlchemy ORM, 文件名统一 *_model.py
│   │   ├── users_model.py          # 用户 (username 唯一, role: user/admin)
│   │   ├── refresh_token.py        # 刷新令牌 (jti 唯一, revoked_at 支持吊销)
│   │   ├── source_model.py         # 新闻源 (type: rss/web, is_active)
│   │   ├── news_model.py           # 新闻 (url 唯一, 正文为 markdown)
│   │   ├── model_model.py          # 大模型信息: OpenRouter 模型对象原样字段 (嵌套结构存 JSON)
│   │   ├── price_history_model.py  # 价格快照 (美元/百万 tokens, 空闲/高峰)
│   │   └── popularity_model.py     # 热度名次快照 (OpenRouter 周榜)
│   │
│   ├── schemas/                    # Pydantic 请求/响应契约, 文件名统一 *_schema.py
│   │   ├── common.py               # PageParams / Page[T] 泛型分页
│   │   ├── users_schema.py
│   │   ├── news_schema.py
│   │   └── model_schema.py
│   │
│   ├── api/
│   │   ├── main.py                 # 路由聚集, 统一挂载到 /api/v1
│   │   ├── deps.py                 # get_current_user / get_current_admin 鉴权依赖
│   │   └── routes/                 # 路由按资源拆分, 只做参数校验与调用 service
│   │       ├── users.py            # 注册/登录/登出/刷新/个人信息/改资料/改密/注销
│   │       ├── admin.py            # 管理员的用户管理 (整路由要求 admin)
│   │       ├── news.py             # 新闻分页列表与详情 (公开)
│   │       ├── models.py           # 模型信息列表/详情/价格历史/热度位次 (公开)
│   │       └── forum.py            # 论坛帖子与评论 (整路由要求登录)
│   │
│   ├── services/                   # 业务逻辑层: HTTP 语义与业务规则
│   │   ├── users_service.py        # 认证流程、token 吊销/轮换、用户生命周期
│   │   ├── news_service.py
│   │   └── model_service.py
│   │
│   ├── crud/                       # 数据访问层: 纯数据库读写, 无 HTTP 语义
│   │   ├── users_crud.py
│   │   ├── refresh_token_crud.py   # token 对的创建/吊销/清理
│   │   ├── news_crud.py            # save_news: url 去尾斜杠规范化 + 去重
│   │   ├── model_crud.py           # save_models 按 api_name upsert; 当日价格快照
│   │   └── popularity_crud.py      # 周榜名次按天幂等写入; 取窗口内的名次
│   │
│   ├── crawlers/
│   │   ├── base.py                 # 基类: 统一 client/超时/UA/异常包装; 模型爬虫分流
│   │   ├── deepseek.py             # DeepSeek 新闻页 -> (标题, 正文 markdown)
│   │   ├── ds_models.py            # (已停用) DeepSeek 定价页解析, 保留备查
│   │   ├── kimi.py                 # Kimi 资讯页 + 模型介绍页 -> 资讯
│   │   ├── kimi_models.py          # (已停用) Kimi 开放平台模型/定价页解析
│   │   ├── mimo.py / mimo_models.py   # 小米 MiMo 新闻页 / (已停用) 模型价格页
│   │   ├── zhipu.py / zhipu_models.py # 智谱研究文章 / (已停用) 模型总览与价格页
│   │   ├── openrouter_models.py    # OpenRouter -> 各厂热门模型信息 + 周榜位次 (唯一模型源)
│   │   └── utils.py                # 随机 UA 等小工具
│   │
│   ├── tasks/
│   │   └── crawl.py                # 采集编排: 爬虫注册表 + 内置源 + 并发抓取/串行入库
│   ├── core/
│   │   ├── database.py             # engine + SQLite pragma (WAL/超时)
│   │   ├── pricing.py              # OpenRouter 定价解析: 空闲/高峰价与时段说明
│   │   └── logging.py              # loguru + stdlib 日志统一走后台线程
│   │
│   └── html/
│       └── deepseek.html           # 目标页样本, 解析器开发与验证用
│
├── alembic/                        # 迁移脚本, versions/ 下按时间戳版本化
├── docs/
│   ├── alembic.md                  # 迁移操作规范
│   └── development-plan.md         # 软件开发计划 (里程碑与排期)
├── .env / .env.example             # 环境配置 (数据库、JWT、管理员账号)
├── alembic.ini
├── pyproject.toml                  # 依赖与项目配置
└── README.md
```

**规划中、尚未创建**的目录：`app/ai/`（摘要/分类/Embedding/Agent）、search / trends / subscriptions 相关模块、`tests/`、`Dockerfile` 与 `docker-compose.yml`。

## 4. 分层架构说明

请求路径为 `API → Service → CRUD → Model`，采集路径为 `Task → Crawler → CRUD → Model`：

### 4.1 API 层（`app/api/`）

接收 HTTP 请求、参数校验、调用 Service 并返回响应；鉴权在 `deps.py` 以 FastAPI 依赖实现，路由级挂载。

| 路由 | 前缀 | 权限 | 职责 |
| --- | --- | --- | --- |
| `users.py` | `/users` | 部分公开 | 注册、登录、登出、刷新 token、`/me`、改资料（`PATCH /me`，目前仅用户名）、改密、注销 |
| `admin.py` | `/admin` | 管理员 | 用户分页列表、按 id 查询、删除用户（需管理员密码确认） |
| `news.py` | `/news` | 公开 | 新闻分页列表（可按源过滤）、详情 |
| `models.py` | `/models` | 公开 | 模型信息列表、详情、价格历史、热度位次 |
| `forum.py` | `/forum` | 登录 | 帖子分页列表、发帖、详情（含评论）、删帖、评论、删评论（作者本人或管理员） |

### 4.2 Service 层（`app/services/`）

业务规则与 HTTP 语义所在层：抛 `HTTPException`、决定状态码（如「密码错误用 400 而非 401，401 专指 token 失效」）、编排多个 CRUD 调用（如注销时先删 token 再删用户）。

### 4.3 CRUD 层（`app/crud/`）

纯数据访问：接收 `AsyncSession` 与参数，返回 ORM 对象或计数，不感知 HTTP。Service 与采集任务（`tasks/crawl.py`）共用这一层，是两者读写同一套表的唯一入口。

### 4.4 数据模型层（`app/models/`）

SQLAlchemy 声明式模型，表结构变更一律走 Alembic 迁移（规范见 [docs/alembic.md](docs/alembic.md)）。当前九张表：`users`、`refresh_tokens`、`sources`、`news`、`models`、`price_history`、`model_popularity`、`forum_posts`、`forum_comments`。

`models` 的字段就是 **OpenRouter 模型对象的字段**：标量（`canonical_slug` / `name` / `created` / `context_length` / `knowledge_cutoff` / `expiration_date`）各占一列，嵌套结构（`architecture` / `pricing` / `top_provider` / `per_request_limits` / `supported_parameters` / `default_parameters` / `supported_voices` / `benchmarks`）原样存 JSON，上游加字段不用改表。价格是 OpenRouter 原样的「美元/token」，界面要的「美元/百万 tokens、空闲/高峰」由 `core/pricing.py` 在响应时算出，不落库。

`price_history`、`model_popularity` 都是**按期快照**表：`price_history` 每轮采集给在售模型记一条当日价格（空闲/高峰，由 `pricing.overrides` 派生），`model_popularity` 记型号当天的热度位次（OpenRouter 周榜只给排序不给热度值，所以存名次而非分数）。两者都靠唯一约束保证同一期重复采集只更新不追加，趋势就是行与行之间比出来的。

### 4.5 Schema 层（`app/schemas/`）

Pydantic 定义请求/响应契约；分页统一复用 `common.Page[T]`，由 `Page.create(items, total, params)` 构造。

### 4.6 爬虫层（`app/crawlers/`）

`base.py` 提供统一底座：共享 httpx client（超时 10s、建连 5s、重试 2 次）、统一 UA、异常包装为 `CrawlerError`（带源名与 url）。支持注入外部 client，便于测试时用 `MockTransport` 离线化。

爬虫分两条管线，通过基类分流：

- **新闻爬虫**（`BaseCrawler` 直接子类）：实现 `fetch()`，产出 `RawNewsItem`（对齐 `news` 表）；
- **模型爬虫**（`ModelsCrawlerBase` 子类）：实现 `fetch_models()`，产出对齐 `ModelModel` 字段的字典；误入新闻管线会直接报错。目前只有 `openrouter_models.py` 一个。

当前每个源是**站点专属解析器**（依赖目标站的 DOM 结构，如 DeepSeek 的 Docusaurus 容器），不做通用抽取；通用 Web/RSS 抽取为规划项。

**模型信息已统一到 `openrouter_models.py`**：各厂官网「模型 & 价格」页的采集全部作废（`ds_models` / `kimi_models` / `mimo_models` / `zhipu_models` 只留在磁盘上备查，不再注册），原因有三 —— 各家页面结构不一、改版即失效；只覆盖 4 家国内厂商，口径无法横向比较；官网价是人民币，与 OpenRouter 的美元价不成固定汇率。

它读 OpenRouter 的公开目录与端点接口，四个维度都做了收窄：

- **热度**：按 `?sort=top-weekly` 的周榜从高到低取，攒够 `HOT_LIMIT`（默认 50）条就停，榜单剩下的不跑 —— 收录范围由实际调用量决定，不需要人工维护。「旗舰」那套人工白名单试过，只有 10 条、太单薄，已去掉；
- **厂商**：只覆盖白名单里的 10 家热门厂家（`VENDORS`，口径为周榜的「热度质量」，见该常量的注释）。这层上限是必要的：不限定厂商会从四百多个模型里收进一堆小厂型号；
- **渠道**：只取厂商自营渠道（端点 tag 的第一段命中该厂商的自营 tag 集合），第三方托管（Together / Novita / 硅基流动等）的价格一概不取 —— 它们不是厂商官方口径。多数厂商的自营 tag 就是作者段，但 Google 是 `google-ai-studio` / `google-vertex`、通义是 `alibaba`，必须单独列出，否则会被误判成「没有自营渠道」。
- **配额**：单家厂商最多 `PER_VENDOR_LIMIT`（默认 5）条。不设上限时榜单会被大厂刷屏（实测 google 12 / openai 11 / anthropic 9，而 deepseek、kimi、小米、腾讯每家只剩 2 条），小厂型号会被全数挤出榜外；加上限后各家席位拉平，总量掉到 40 条上下（够格的候选就这么多，不为凑满而回填）。

定价原样写入 `models.pricing`（美元/token 的字符串 + `overrides`），不折算人民币。`overrides` 里两层信息都不解析就会丢，界面要用的派生值由 `app/core/pricing.py` 在响应时算：

- **时段价（峰谷）**：带 `utc_start` / `utc_end` / `utc_days` 的条目给出各时段单价。方向不固定 —— DeepSeek 是工作日高峰翻倍（$0.15 → $0.30），腾讯 hy3 是深夜打折（$0.132 → $0.0825），所以按计费项取最小当「空闲」、最大当「高峰」；只有一个价时高峰三列留 NULL，前端据此判断该型号有没有峰谷。
- **长上下文档位价**：带 `min_prompt_tokens` 的条目是提示变长后的加价（如 gpt-6-astra 超 272K 后输入从 $5 涨到 $10），与时段无关，没有对应字段，写进响应里的 `price_notes`。

时段窗口按 `H*100+M` 编码（1600 = 16:00 UTC），换算成北京时间写进响应里的 `price_notes`，如「高峰（北京时间, 单价 ×2）工作日 09:00–12:00、工作日 14:00–18:00」；长上下文档位同样进 `price_notes`。价格快照（`price_history`）只在入库时派生一次，口径相同。

周榜每周都在动，型号会进出榜单：没抓到的自动置为下架（`is_active=False`，不删除，价格快照保留），重新上榜会自动回到在售。

配额与自营渠道两层都可能让结果少于 `HOT_LIMIT`：前者是设计使然（只记 info），后者才会告警（说明该调 `HOT_POOL`）。每轮会打一行各厂收录分布日志，便于核对。

**能力指标直接取 OpenRouter 目录里的 `benchmarks.artificial_analysis`**（智能 / 编程 / Agent 三个指数，原样存 `models.benchmarks`），不再抓外部榜单：能力这一维只留一个来源才可比，缺指数的型号在散点图里不画入。早先接过 LMArena（HuggingFace 上的 `lmarena-ai/leaderboard-dataset`，需要按模型名归一化匹配、爬虫与 `model_rankings` 表都为此存在），现已整体移除。

### 4.7 任务层（`app/tasks/`）

`crawl.py` 是采集编排中心：

- `CRAWLER_REGISTRY` 只登记新闻爬虫，按 `source.name` 映射到实现，**新增站点 = 实现爬虫 + 注册 + 加入内置源列表**；
- 首次运行自动创建 `BUILTIN_SOURCES`（当前 deepseek / kimi / mimo / zhipu）；
- 模型信息不挂在厂商源下：`MODEL_SOURCE`（openrouter）以 `is_active=False` 建一条记录，只作 `models.source_id` 的外键锚点，不参与新闻抓取；
- 抓取用 `asyncio.gather` 并发（新闻与模型信息同时抓），入库共享同一个 `AsyncSession` 因此串行执行，最后统一 commit；
- 热度位次在模型之后抓（名次要落到本轮刚入库的 `models.id` 上），顺序固定为「抓取（新闻+模型+位次）→ 入库」；入库阶段不再有任何网络请求；
- 单源失败只记日志，不中断其他源；模型抓取失败同样不影响新闻；
- 换数据源或重建字段时用 `python -m app.tasks.reset_models` 清空模型信息（`models` + `price_history` + `model_popularity`，按外键顺序清），再跑一轮采集回填。

## 5. 认证与权限设计

```text
注册/登录 ──> 颁发 token 对:
             access  (15 min, 无状态 JWT, type=access)
             refresh (7 天, JWT type=refresh, jti 落 refresh_tokens 表)

请求资源 ──> HTTPBearer ──> decode access ──> get_current_user
             admin 路由再经 get_current_admin 校验 role

access 过期 ──> /users/refresh ──> 校验 jti 未吊销
             ──> 吊销旧 refresh + 颁发新对 (轮换) + 顺手清理过期/已吊销 token

登出 ──> 吊销当前 refresh
改密/注销/管理员删户 ──> 删除该用户全部 refresh token
```

要点：

- access token 不落库，失效靠过期；吊销能力只作用于 refresh，刷新即轮换；
- 密码使用 argon2 哈希（pwdlib）；
- 初始管理员在 `main.py` 的 lifespan 中按 `.env` 配置创建（不存在时）。

## 6. 核心数据流

```text
┌──────────────────── API 进程 (uvicorn) ────────────────────┐
│ lifespan: 创建初始管理员 + 启动 APScheduler                 │
│   采集: 每 24h 一轮, max_instances=1 防堆积, 启动即跑一轮   │
└───────────────────────────┬────────────────────────────────┘
                            v
                   tasks/crawl.run_crawl
                            │ 兜底创建内置源, 取全部启用源
                            v
      asyncio.gather 并发抓取 (失败仅记日志)
      ├── 新闻爬虫  CRAWLER_REGISTRY   (deepseek / kimi / mimo / zhipu)
      └── 模型信息  OpenRouterModelsCrawler (10 家热门厂家的热门型号 + 周榜位次)
                            │
                            v 串行入库 (共享一个 AsyncSession, 全程无网络请求)
      ├── crud/news_crud.save_news     url 去尾斜杠规范化后去重,
      │                                 已存在则跳过 (新闻视为不可变)
      ├── crud/model_crud.save_models  按 api_name upsert (源: openrouter),
      │                                 本轮没抓到的同源模型置为下架,
      │                                 并给当日写一条价格快照
      └── crud/popularity_crud.save_popularity
                                           按 (模型, 来源, 采集日) 幂等
                            │
                            v 统一 commit
                        SQLite (表结构由 Alembic 迁移管理)
                            │
                            v
              /api/v1/news · /api/v1/models (公开)
```

规划中在入库后追加 `process_news` AI 处理任务（摘要、分类、Embedding），并周期性生成趋势，见开发计划 M3/M4。

## 7. 关键设计考虑

- **Service 与 CRUD 分层**：业务规则（HTTP 语义、错误码、编排）在 Service；数据库读写集中在 CRUD。采集任务不经过 Service 直接用 CRUD，避免把 HTTP 语义带进后台任务。
- **可变与不可变数据的入库策略**：新闻按 url 去重、只增不改；模型信息按 `api_name` upsert、官网覆盖。两类数据性质不同，策略刻意不同。
- **URL 规范化去重**：入库前去尾部斜杠，同一页面带/不带斜杠视为一条——官网 CDN 对两种写法的重定向行为不稳定，不能依赖最终 url 一致。
- **采集与 API 同进程**：APScheduler 随 API 进程常驻，避免为单机小流量引入消息队列/独立 worker 的复杂度；用 `max_instances=1` + `coalesce` 防止任务堆积。这是有意的权衡，任务变重再拆（计划 R4）。
- **抓取与入库分两段**：`run_crawl` 先把新闻、模型、榜单全部抓完，再开写事务一次性落库，抓取阶段不持有任何数据库连接。反过来的写法（边抓边写）会让一个 SQLite 写事务持续几十秒，同机器上别的进程一写就撞 `database is locked`。
- **SQLite 走 WAL**（`core/database.py` 的 connect pragma）：默认的 rollback journal 模式下，长写事务会把读请求一并挡住 —— 采集和 API 同进程，一轮采集能写几十秒，期间接口集体卡死。WAL 让读写互不阻塞，另设 `busy_timeout=10s` 给并发写留等待余量。
- **日志不阻塞主线程**（`core/logging.py`）：loguru 与标准库 logging（SQLAlchemy 的 echo 走这条）统一进 `enqueue=True` 的后台队列。踩过的坑 —— 开发模式下每条 SQL 都 echo，一轮采集上万行；终端一旦不再消费输出（窗口卡住 / 缓冲满），阻塞的 write 会把事件循环连同整轮采集冻住，采集卡在写库中途不放手、API 全部无响应。SQLAlchemy 开 echo 时还会给自己的 logger 偷挂一个同步 handler，用 `NullHandler` 占位挡掉。
- **爬虫可测试性**：client 支持外部注入（`MockTransport`），解析逻辑与网络IO分离，`app/html/` 保存页面样本供解析验证。
- **token 轮换**：每次刷新都吊销旧 refresh 并颁发新对，兼顾安全（泄漏窗口小）与实现简单。
- **已知待办**（对应开发计划 M1）：CORS 当前 `allow_origins=["*"]`、`SECRET_KEY`/`ADMIN_PASSWORD` 有默认值、无限流与自动化测试——上线前必须收敛。

## 8. 部署结构

现状（开发期）：

```text
uv run uvicorn app.main:app   # 单进程: API + 进程内定时采集
SQLite 文件库 (test.db), 表结构由 alembic 迁移管理
```

规划（对应开发计划 M1/M5）：

```text
Dockerfile         -> 构建后端镜像
docker-compose.yml -> 编排 api + PostgreSQL (+ 反向代理 TLS)
```

## 9. 规划中的模块

| 模块 | 内容 | 对应里程碑 |
| --- | --- | --- |
| `app/ai/` | LLM Provider 抽象、摘要、分类打标、Embedding、Agent | M3/M4 |
| search | 关键词 + 语义混合检索 | M3/M4 |
| trends | 分类/实体热度聚合与时序接口 | M4 |
| subscriptions | 订阅源/分类与 digest 推送 | M5 |
| 数据模型 | categories / tags / entities / reports 等新表 | M2–M5 |

具体任务分解、验收标准与排期见 [docs/development-plan.md](docs/development-plan.md)；每个里程碑合入后同步更新本文档。
