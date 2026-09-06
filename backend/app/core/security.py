from pwdlib import PasswordHash
from datetime import datetime, timezone, timedelta
from app.core.config import settings
import jwt

password_hasher = PasswordHash.recommended()


def hash_password(password: str):
    """密码哈希"""
    return password_hasher.hash(password)


def verify_password(password: str, hasded_password: str):
    """校验密码"""
    return password_hasher.verify(password, hasded_password)


def create_access_token(user_id: int):
    """创建 access_token"""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "user_id": str(user_id),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: int, jti: str):
    """创建 refresh_token"""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "user_id": str(user_id),
        "exp": expire,
        "type": "refresh",
        "jti": jti,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str):
    """解 access_token 拿到 user_id"""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Token type mismatch")
    try:
        return int(payload["user_id"])
    except (KeyError, TypeError, ValueError):
        raise jwt.InvalidTokenError("Invalid user_id claim")


def decode_refresh_token(token: str):
    """解 refresh_token 拿到 user_id, jti"""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("type") != "refresh":
        raise jwt.InvalidTokenError("Token type mismatch")
    try:
        return {
            "user_id": int(payload["user_id"]),
            "jti": payload["jti"],
        }
    except (KeyError, TypeError, ValueError):
        raise jwt.InvalidTokenError("Invalid token claims")
