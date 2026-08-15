"""
Redis connectivity and cache helpers.

The application degrades gracefully when Redis is unavailable: every helper
in this module falls back to a cache miss / no-op instead of raising, so the
platform keeps working without Redis.

Configuration is read from the ``REDIS_URL`` environment variable
(see ``app/core/config.py`` for the default).
"""

import os
import json
import logging

logger = logging.getLogger(__name__)

_client = None
_available = None


def get_redis():
    """Return a lazily-initialised, long-lived Redis client, or ``None`` if unavailable."""
    global _client, _available

    if _available is False:
        return None

    if _client is None:
        try:
            from redis import Redis
            from redis.exceptions import RedisError

            url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
            client = Redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
                retry_on_timeout=True,
            )
            client.ping()
            _client = client
            _available = True
            logger.info("[InCubein] Redis connected: %s", url.rsplit("@", 1)[-1])
        except Exception as exc:  # noqa: BLE001
            _available = False
            logger.warning("[InCubein] Redis unavailable (%s) — running without cache.", exc)

    return _client if _available else None


def is_connected() -> bool:
    return get_redis() is not None


def cache_get(key: str, default=None):
    """Fetch a JSON value from the cache. Returns ``default`` on miss or failure."""
    client = get_redis()
    if client is None:
        return default
    try:
        raw = client.get(key)
        if raw is None:
            return default
        return json.loads(raw)
    except Exception:  # noqa: BLE001
        return default


def cache_set(key: str, value, ttl: int = 300) -> bool:
    """Store a JSON value in the cache with a TTL (seconds). Returns success."""
    client = get_redis()
    if client is None:
        return False
    try:
        return bool(client.set(key, json.dumps(value, default=str), ex=ttl))
    except Exception:  # noqa: BLE001
        return False


def cache_delete(key: str) -> bool:
    """Delete a single key from the cache. Returns success."""
    client = get_redis()
    if client is None:
        return False
    try:
        return bool(client.delete(key))
    except Exception:  # noqa: BLE001
        return False


def invalidate(prefix: str) -> int:
    """Delete every key starting with ``prefix``. Returns number of keys removed."""
    client = get_redis()
    if client is None:
        return 0
    try:
        keys = client.keys(f"{prefix}*")
        if keys:
            return int(client.delete(*keys))
        return 0
    except Exception:  # noqa: BLE001
        return 0
