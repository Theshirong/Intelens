from app.core.security import hash_password, verify_password
from app.schemas.users_schema import UserRegisterRequest, UserPasswordRequest
from app.models.users_model import User

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession


async def create_user(db: AsyncSession, user_create: UserRegisterRequest) -> User:
    """
    创建用户;
    user_create: 创建用户参数;
    db: 数据库会话;
    return: 创建的用户
    """
    password = hash_password(user_create.password)
    obj = User(
        username=user_create.username,
        hashed_password=password,
    )
    db.add(obj)
    # 把 SQL 发给数据库执行
    await db.flush()
    await db.refresh(obj)
    return obj


async def create_user_with_role(
    db: AsyncSession, username: str, password: str, role: str
) -> User:
    """
    创建管理员用户
    """
    obj = User(
        username=username,
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(obj)
    # 把 SQL 发给数据库执行
    await db.flush()
    await db.refresh(obj)
    return obj


async def get_by_username(db: AsyncSession, username: str) -> User | None:
    """
    通过 username 获取用户信息;
    return User
    """
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    """查询单个用户信息
    return User"""
    return await db.get(User, user_id)


async def get_users_list(db: AsyncSession) -> tuple[list[User], int]:
    """查询所有用户信息"""
    # 查询用户数量
    count_query = select(func.count()).select_from(User)
    total = (await db.execute(count_query)).scalar_one()
    # 查询用户对象列表
    result = await db.execute(select(User))
    items = list(result.scalars().all())
    return items, total


async def update_password(
    db: AsyncSession, user_id: int, data: UserPasswordRequest
) -> None:
    """修改密码"""
    # 先查询是否有用户存在, 验证原密码
    obj: User | None = await db.get(User, user_id)
    if not obj:
        raise LookupError("用户不存在")
    # 密码正确才可以修改密码
    if not verify_password(data.old_password, obj.hashed_password):
        raise ValueError("密码错误")
    obj.hashed_password = hash_password(data.new_password)
    await db.flush()


async def delete_user(db: AsyncSession, user_id: int) -> bool:
    """注销用户"""
    # 先查询是否有用户存在
    obj: User | None = await db.get(User, user_id)
    if not obj:
        return False
    await db.delete(obj)
    await db.flush()
    return True
