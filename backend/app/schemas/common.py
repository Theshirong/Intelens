from math import ceil
from typing import Generic, TypeVar
from pydantic import BaseModel, Field

# 用于指定不同的数据
T = TypeVar("T")


class PageParams(BaseModel):
    """通过分页查询参数"""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class Page(BaseModel, Generic[T]):
    """通过分页响应"""

    items: list[T]
    # 总共数据
    total: int
    # 当前页数
    page: int
    # 每页大小
    page_size: int
    # 页数
    pages: int

    # 页数在此运算，方便调用
    @classmethod
    def create(cls, items, total: int, params: PageParams):
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            pages=ceil(total / params.page_size),
        )
