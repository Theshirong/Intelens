# Intelens 前端

NEXUS AI NEWS —— AI 新闻情报站前端，依据设计稿实现，对接后端 `http://127.0.0.1:8000` 的 OpenAPI 接口。

## 技术栈

- **React 18 + TypeScript + Vite 5**
- **Tailwind CSS 3** + **shadcn/ui** (Radix UI)
- **TanStack Router** (文件式路由) + **TanStack Query** (数据请求)
- **zustand** (认证状态持久化) · **recharts** (趋势图表) · **react-markdown** (新闻正文渲染)

## 快速开始

```bash
cd frontend
npm install
npm run dev        # 开发服务器 http://localhost:5173
npm run build      # 生产构建 (tsc 类型检查 + vite build)
```

开发模式通过 Vite 代理将 `/api` 转发到 `http://127.0.0.1:8000`（见 `vite.config.ts`），
后端已开启 CORS，也可用 `VITE_API_BASE` 环境变量直连。

默认管理员账号见 `backend/.env`（admin / admin123）。新闻接口需要登录，
未登录访问受保护页面会自动跳转到 `/login`。

## 页面结构

| 路由 | 页面 | 数据来源 |
|---|---|---|
| `/login` | 登录 / 注册 | `POST /users/login` `POST /users/register` |
| `/` | 首页 (设计稿还原) | `GET /news` (头条+列表+统计) `GET /news/{id}` (头条摘要) |
| `/news` | 资讯列表 (来源筛选 / 分页 / 每页条数) | `GET /news?page&page_size&source_id` |
| `/news/:id` | 资讯详情 (Markdown 正文) | `GET /news/{id}` |
| `/workspace` | 工作台 (个人资料 / 改密 / 注销 / 用户管理) | `GET /users/me` `PATCH /users/me/password` `DELETE /users/me` `GET /admin/users_all` `DELETE /admin/{user_id}` |

首页中「模型追踪」「AI 趋势图谱」「研究洞察」区块为演示数据（后端暂无对应接口）。

## 认证机制

- 登录后 `access_token` / `refresh_token` 持久化在 localStorage（zustand persist）。
- 所有请求自动附带 Bearer token；收到 401 时单飞（single-flight）调用
  `POST /users/refresh` 换新 token 并重试一次。
- refresh 失败则清空登录态并跳转登录页；改密 / 注销成功后自动退出。

## 目录结构

```
src/
├── api/            # TanStack Query 请求 hooks (auth / news / admin)
├── components/
│   ├── home/       # 首页区块: hero / news-grid / model-watch / trend-map / insight
│   ├── layout/     # 顶部导航 + 页脚 + 锚点滚动
│   └── ui/         # shadcn/ui 组件
├── lib/            # api-client (带 token 刷新) / 格式化工具
├── routes/         # TanStack Router 文件式路由 (_app 布局含登录守卫)
├── stores/         # zustand 认证 store
└── types/          # 后端 OpenAPI 对应类型
```
