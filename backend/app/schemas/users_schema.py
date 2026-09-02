from pydantic import BaseModel, Field, model_validator, ConfigDict
from datetime import datetime
from typing import Annotated


class UserRegisterRequest(BaseModel):
    """注册用户"""

    username: Annotated[str, Field(min_length=3, max_length=20, description="用户名称")]
    password: Annotated[str, Field(min_length=6, max_length=20, description="用户密码")]
    password_confirm: Annotated[
        str, Field(min_length=6, max_length=20, description="确认密码")
    ]

    # 确认前后设置的密码是否相同
    @model_validator(mode="after")
    def check_password_match(self):
        if self.password != self.password_confirm:
            raise ValueError("两次密码不一致")
        return self


class UserLogin(BaseModel):
    """用户登入"""

    username: Annotated[str, Field(min_length=3, max_length=20, description="用户名称")]
    password: Annotated[str, Field(min_length=6, max_length=20, description="用户密码")]


class UserPasswordRequest(BaseModel):
    """修改密码"""

    old_password: Annotated[
        str, Field(min_length=6, max_length=20, description="旧密码")
    ]
    new_password: Annotated[
        str, Field(min_length=6, max_length=20, description="新密码")
    ]


class UserDeleteRequest(BaseModel):
    """注销用户"""

    password: Annotated[str, Field(min_length=6, max_length=20, description="用户密码")]


class UserResponse(BaseModel):
    """用户信息响应信息"""

    id: int
    username: str
    # 用于从 orm 获取数据
    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """所有用户及数量"""

    items: list[UserResponse]
    total: int

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """登录 token"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """刷新 token"""

    refresh_token: str
