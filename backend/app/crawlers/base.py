from abc import ABC, abstractmethod
from datetime import datetime
from types import TracebackType
from typing import Self

import httpx
from pydantic import BaseModel

from app.core.config import settings
from app.models.source_model import SourceModel


class RawNewsItem(BaseModel):
    """爬虫产出的原始新闻, 字段对齐 news 表

    fetched_at 由数据库 server_default 生成, 不在此处填充。
    """

    title: str
    url: str
    content: str | None = None
    published_at: datetime | None = None


class CrawlerError(Exception):
    """爬虫层统一异常, 由上层 (tasks/crawl.py) catch 后记日志"""

    def __init__(
        self,
        message: str,
        # 指定后面的参数必须为关键词传参
        *,
        source_name: str | None = None,
        url: str | None = None,
    ) -> None:
        self.source_name = source_name
        self.url = url
        super().__init__(message)

    # 把对象转字符串, 用于打印错误
    def __str__(self) -> str:
        # 让日志里一行就能看出是哪个源、哪个链接挂了
        parts = [super().__str__()]
        if self.source_name:
            parts.append(f"source={self.source_name}")
        if self.url:
            parts.append(f"url={self.url}")
        return " | ".join(parts)


# 统一超时: 总体 10s, 建连 5s
DEFAULT_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
DEFAULT_HEADERS = {
    "User-Agent": f"{settings.PROJECT_NAME}Bot/0.1 (+https://example.com/bot)",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


class BaseCrawler(ABC):
    """爬虫基类: 统一 httpx 客户端、超时、UA 和异常包装"""

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        # 允许外部注入: 多个源共享连接池, 测试时可换 MockTransport
        self._client = client
        self._owns_client = client is None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=DEFAULT_TIMEOUT,
                headers=DEFAULT_HEADERS,
                follow_redirects=True,
                transport=httpx.AsyncHTTPTransport(retries=2),
            )
        return self._client

    async def aclose(self) -> None:
        """只关闭自己创建的 client, 注入的交给调用方管理"""
        if self._client is not None and self._owns_client:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    @abstractmethod
    async def fetch(self, source: SourceModel) -> list[RawNewsItem]:
        """抓取并解析单个源

        单条数据解析失败应跳过, 整个源不可用时抛 CrawlerError。
        """
        raise NotImplementedError

    async def _get(self, url: str, source: SourceModel | None = None) -> httpx.Response:
        """子类统一走这里发请求, httpx 异常一律包装成 CrawlerError"""
        source_name = source.name if source is not None else None
        try:
            response = await self.client.get(url)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise CrawlerError(
                f"HTTP {e.response.status_code}", source_name=source_name, url=url
            ) from e
        except httpx.TimeoutException as e:
            raise CrawlerError("请求超时", source_name=source_name, url=url) from e
        except httpx.HTTPError as e:
            # 连接错误、代理错误、重定向过多等
            raise CrawlerError(
                f"请求失败: {type(e).__name__}", source_name=source_name, url=url
            ) from e
        return response
