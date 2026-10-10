# Intelens 启动指南

Intelens 是一个 AI 新闻情报系统,采用前后端分离架构:

| 部分 | 技术栈 | 默认地址 |
| --- | --- | --- |
| 后端 `backend/` | FastAPI + SQLAlchemy(async) + SQLite + Alembic + APScheduler | http://127.0.0.1:8000 |
| 前端 `frontend/` | React 18 + TypeScript + Vite 5 + Tailwind + TanStack Router/Query | http://localhost:5173 |

后端对外接口前缀为 `/api/v1`;前端开发服务器会把 `/api` 请求代理到后端。

## 环境要求

- **Python 3.14**(`backend/.python-version` 指定,`pyproject.toml` 要求 `>=3.14`)
- **uv**(后端依赖与虚拟环境由 uv 管理,锁文件为 `backend/uv.lock`)
- **Node.js 18+ 与 npm**(前端,Vite 5 要求)

检查版本:

```bash
python3 --version     # 期望 >= 3.14
node --version         # 期望 >= 18
npm --version
uv --version
```

若本机没有 uv,先安装:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或使用 pip
pip install uv
```

## 一、启动后端

```bash
cd backend

# 1. 准备环境变量(可选,不建也能跑,会使用 config.py 中的默认值)
cp .env.example .env

# 2. 安装依赖并创建虚拟环境 .venv(依据 uv.lock)
uv sync

# 3. 建库:执行 Alembic 迁移,生成 test.db 及各张表
#    ⚠️ 必须执行这一步,启动时不会自动建表
uv run alembic upgrade head

# 4. 启动 API(开发模式,--reload 为热重载)
uv run uvicorn app.main:app --reload
```

启动成功后:

- API 根地址:http://127.0.0.1:8000
- 交互式文档:http://127.0.0.1:8000/docs
- SQLite 数据库文件:`backend/test.db`
- 初始管理员账号(`backend/.env` 可改):**admin / admin123**

> 后端启动时(`app/main.py` 的 lifespan)会做两件事:
> 1. 若管理员不存在则按 `.env` 创建;
> 2. 启动 APScheduler 定时采集,**并立即跑一轮抓取**(每 24 小时一轮)。
> 首轮采集需要访问各厂官网 / OpenRouter,若当前网络受限,启动仍会成功,
> 只是日志里会看到抓取报错,属正常现象。

常用后端命令(同样在 `backend/` 下执行):

```bash
uv run python -m app.tasks.crawl          # 手动跑一轮采集
uv run python -m app.tasks.reset_models   # 清空模型 / 价格 / 榜单数据后重新采集
uv run alembic revision --autogenerate -m "描述"   # 生成新的迁移脚本
```

## 二、启动前端

另开一个终端:

```bash
cd frontend

npm install
npm run dev
```

打开 http://localhost:5173 ,未登录会自动跳转到 `/login`,
用 `admin / admin123` 登录即可。

前端开发服务器已配置代理(`frontend/vite.config.ts`):`/api` → `http://127.0.0.1:8000`,
因此**必须先启动后端**,前端才能拿到数据。如需直连其他后端地址,设置环境变量:

```bash
VITE_API_BASE=http://127.0.0.1:8000/api/v1 npm run dev
```

其他前端命令:

```bash
npm run build      # 生产构建(先 tsc 类型检查,再 vite build)
npm run preview    # 预览生产构建产物
npm run lint       # ESLint
```

## 三、一次性跑通(两个终端)

终端 A —— 后端:

```bash
cd backend && uv sync && cp -n .env.example .env; uv run alembic upgrade head && uv run uvicorn app.main:app --reload
```

终端 B —— 前端:

```bash
cd frontend && npm install && npm run dev
```

然后浏览器访问 http://localhost:5173 ,使用 `admin / admin123` 登录。

## 常见问题

- **启动报错 `no such table: users`**:没有执行数据库迁移,回到 `backend/` 运行 `uv run alembic upgrade head`。
- **前端登录 / 加载数据 404 或连接被拒**:后端没起来,或不在 8000 端口。先确认 http://127.0.0.1:8000/docs 可访问。
- **`uv: command not found`**:uv 未安装,见上文“环境要求”。
- **Python 版本不符**:`uv sync` 会依据 `.python-version` 自动拉取 3.14,无需手动切换。
- **采集一直失败**:本项目采集依赖外网(各厂官网、OpenRouter),内网环境属预期失败,不影响 API 与前端使用。
