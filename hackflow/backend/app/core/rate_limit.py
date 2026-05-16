"""Redis-based sliding-window rate limiter for FastAPI via Depends."""
import time

import redis.asyncio as aioredis
from fastapi import HTTPException, Request, status

from app.core.config import get_settings

_redis_client: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


class RateLimiter:
    """
    Usage:
        @router.post("/login")
        async def login(
            _rl: None = Depends(RateLimiter(limit=10, window_seconds=60)),
            ...
        ):
    """

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds

    async def __call__(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"rl:{request.url.path}:{client_ip}"
        r = _get_redis()
        now = int(time.time())
        pipe = r.pipeline()
        pipe.zadd(key, {str(now): now})
        pipe.zremrangebyscore(key, 0, now - self.window_seconds)
        pipe.zcard(key)
        pipe.expire(key, self.window_seconds)
        results = await pipe.execute()
        count = results[2]
        if count > self.limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"[ERR] rate limit exceeded — retry after {self.window_seconds}s",
                headers={"Retry-After": str(self.window_seconds)},
            )
