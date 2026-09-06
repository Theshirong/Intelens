# Alembic 使用指南

> 本文档记录本项目中 Alembic 的使用方式、常见场景与注意事项。

## 核心原则

**model 是唯一事实来源，迁移文件是它的变更历史。**

你改 `app/models/`，Alembic 负责把数据库追上去。数据库结构永远不要手改，也不要再用 `create_all` —— 建表职责已经完全交给 Alembic，`lifespan` 里不再调用 `init_db()`。

## 日常循环

90% 的时间只会用到这两条命令，改完 model 就跑：

```bash
# 1. 对比 model 和数据库，生成迁移文件
uv run alembic revision --autogenerate -m "简短说明"

# 2. 打开 alembic/versions/ 里新生成的文件，逐行审查   ← 别跳过
# 3. 应用到数据库
uv run alembic upgrade head
```

第 2 步是习惯问题。autogenerate 是"猜"出来的，它不懂你的意图，只做结构对比。生成的东西是普通 Python 代码，可以随意修改。

## 什么时候会用到

按 `ARCHITECTURE.md` 的规划，接下来要加 `news`、`source`、`category`、`tag`、`entity`、`subscription` 这些表，每一次都会走一遍上面的循环。

| 场景 | 处理方式 |
| --- | --- |
| 新增一张表 | 写 model → 在 `models/__init__.py` 里导出 → autogenerate |
| 加字段 / 删字段 | 改 model → autogenerate |
| 改字段类型、改 `server_default` | 同上（已开 `compare_type` 和 `compare_server_default`，能检测到） |
| 加索引、加唯一约束 | 同上 |
| **重命名表 / 字段** | autogenerate 会生成 drop + add，**会丢数据**，必须手改 |
| 回填数据、拆分字段 | autogenerate 检测不到，手写迁移 |
| 拉取了别人的新迁移 | 只需 `alembic upgrade head` |
| 部署 | 启动服务前先 `alembic upgrade head` |

### 新增 model 的必做一步

往 `app/models/__init__.py` 里加导出。忘了的后果不是报错，而是 autogenerate 生成一个空的 `upgrade()` —— 因为 `Base.metadata` 里根本没有那张表。

以加 news 表为例：

```python
# app/models/news_model.py
class News(Base):
    __tablename__ = "news"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(index=True)
    ...
```

```python
# app/models/__init__.py  ← 必须补
from app.models.news_model import News
__all__ = ["User", "RefreshToken", "News"]
```

```bash
uv run alembic revision --autogenerate -m "add news table"
uv run alembic upgrade head
```

## 重命名必须手改

这是最容易踩的坑。假如把 `News.title` 改名成 `headline`，autogenerate 会生成：

```python
op.add_column('news', sa.Column('headline', sa.String()))
op.drop_column('news', 'title')     # 原有数据全丢
```

手改成：

```python
with op.batch_alter_table('news') as batch_op:
    batch_op.alter_column('title', new_column_name='headline')
```

表重命名同理，用 `op.rename_table('old', 'new')`。

## 数据迁移

结构变了但老数据需要适配时，autogenerate 帮不了你，要自己在迁移文件里写：

```python
def upgrade() -> None:
    op.add_column('news', sa.Column('slug', sa.String(), nullable=True))
    # 结构改完后回填
    op.execute("UPDATE news SET slug = lower(replace(title, ' ', '-')) WHERE slug IS NULL")
    with op.batch_alter_table('news') as batch_op:
        batch_op.alter_column('slug', nullable=False)
```

迁移里用 `op.execute()` 写原生 SQL 或 `sa.table()` 构造轻量表结构，**不要 import 项目的 model**。model 会随代码演进，而迁移文件必须永远能重放当年的那次变更 —— import model 的迁移过几个月就跑不动了。

## 常用命令

```bash
uv run alembic current               # 当前版本
uv run alembic history --verbose     # 全部历史
uv run alembic heads                 # 有几个 head（>1 说明分支冲突了）
uv run alembic upgrade head          # 升到最新
uv run alembic downgrade -1          # 回退一版
uv run alembic check                 # 检查 model 与迁移是否有漂移，不生成文件
uv run alembic upgrade head --sql    # 只打印 SQL 不执行，上生产前预览
```

`alembic check` 适合放进 CI —— 它在有人改了 model 但忘记生成迁移时会失败。

## 多人协作

如果各自生成了迁移再合并，会出现两个 head（`down_revision` 指向同一个父节点）。`alembic heads` 能看出来，用这个合并：

```bash
uv run alembic merge heads -m "merge"
```

避免的办法是先 pull 再生成迁移。

## 待办：给 Base 加命名约定

`app/core/database.py` 里的 `Base` 目前是空的。SQLite 上的约束（外键、唯一、CHECK）如果没有显式名字，将来 batch 模式想删改它们会失败 —— 没有名字就没法引用。标准做法：

```python
from sqlalchemy import MetaData

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=convention)
```

现在加最划算 —— 目前只有两张表，删库重建一次成本极低。等表多了再加，已有约束的名字和约定对不上，得写一版专门重命名约束的迁移。

加完之后 autogenerate 会检测到约束名变化，删掉 `test.db` 和初始迁移文件重新生成一次最干净。

## 换 PostgreSQL 时

**迁移历史重来，Alembic 的配置和用法完全不用动。**

不用动的：`alembic.ini`、`alembic/env.py`（`IS_SQLITE` 判断会自动关掉 batch 模式）、`models/__init__.py`、所有命令。只改 `.env` 里的 `DATABASE_URL`，加个 `asyncpg` 依赖。

要重来的：`alembic/versions/` 下的迁移文件。删掉重新 autogenerate 一版初始迁移，在空 PG 库上 `upgrade head`。

### 为什么不能直接重放旧迁移

同一个 `User` model 在两种方言下编译出的 DDL：

```sql
-- SQLite
id INTEGER NOT NULL,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,

-- PostgreSQL
id SERIAL NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
```

差异在自增主键（`INTEGER` vs `SERIAL`）和时间类型（`DATETIME` 无时区 vs `TIMESTAMPTZ`）。这些由 SQLAlchemy 按方言渲染，`op.create_table` 用抽象类型，理论上能跨方言重放。

真正的麻烦是迁移文件里**已经固化成字面量**的东西。比如初始迁移里：

```python
server_default=sa.text('(CURRENT_TIMESTAMP)')
```

这是 autogenerate 从 SQLite 反射出来的字符串，PG 上语义不同（`CURRENT_TIMESTAMP` 在 PG 里是事务开始时间，不是语句时间）。还有 `batch_alter_table` 包裹的索引操作 —— 在 PG 上虽然会退化成普通 ALTER 能跑，但纯属多余。

### 切换步骤

```bash
uv add "asyncpg" "psycopg[binary]"   # asyncpg 跑应用, psycopg 备用
```

`.env` 改成：

```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/intelens
```

然后：

```bash
rm alembic/versions/2026*.py
uv run alembic revision --autogenerate -m "init schema on postgres"
uv run alembic upgrade head
```

注意 `role` 字段：`Mapped[Literal["user", "admin"]]` 在 PG 上会渲染成 `VARCHAR(5)`（因为 `native_enum=False`），不是 PG 原生 enum。这是好事 —— PG 原生 enum 加值要 `ALTER TYPE`，很难迁移。保持现状就行。

### 如果生产已经有数据

"删掉重新生成"只适用于开发阶段。生产库有数据时，切库就不是 Alembic 的事了 —— 那是数据迁移，要用 `pgloader` 之类的工具搬数据，Alembic 只负责在目标库上先建好结构。

顺序是：PG 空库 `upgrade head` 建结构 → 搬数据 → 校验行数。

## 本项目的接入记录

初次接入做的事（提交 `c7a072d`）：

1. `uv add alembic`，`uv run alembic init -t async alembic`（异步模板，因为 engine 是 `create_async_engine`）
2. `alembic.ini` 注释掉 `sqlalchemy.url`，URL 从 `settings` 读；加 `file_template` 让迁移文件名带时间戳
3. `env.py` 里 `config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)`，绑定 `Base.metadata`，`import app.models` 触发注册
4. 开启 `compare_type` / `compare_server_default`，SQLite 下 `render_as_batch=True`
5. `app/models/__init__.py` 统一导出模型
6. 生成初始迁移，`app/main.py` 移除 `init_db()` 调用

### 踩过的坑

`KeyError: 'url'` —— `alembic.ini` 里注释掉了 `sqlalchemy.url`，但 `env.py` 还是 init 生成的原始模板（没有 `set_main_option`），section 里没有 `url` 键，`async_engine_from_config` 就报这个。改完 `env.py` 即可。
