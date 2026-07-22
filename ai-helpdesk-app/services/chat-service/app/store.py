"""
Conversation history store.

This ships with a simple in-memory implementation, which is fine for a
single-replica deployment or local dev. Because this service will typically
run with multiple Kubernetes replicas behind a Service (no sticky sessions),
a given user's follow-up message can land on a different pod than the one
that holds their history in memory.

For real multi-replica deployments, swap InMemoryStore for a Redis-backed
store (see the commented RedisStore skeleton below) and point it at a
Redis deployment/StatefulSet in the same namespace. The interface is the
same either way so nothing else in the app needs to change.
"""

from collections import defaultdict, deque
from threading import Lock

from .config import settings


class InMemoryStore:
    def __init__(self) -> None:
        self._sessions: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=settings.MAX_HISTORY_TURNS * 2)
        )
        self._lock = Lock()

    def get(self, session_id: str) -> list[dict]:
        with self._lock:
            return list(self._sessions[session_id])

    def append(self, session_id: str, role: str, content: str) -> None:
        with self._lock:
            self._sessions[session_id].append({"role": role, "content": content})


# --- Example Redis-backed alternative (uncomment and `pip install redis` to use) --
#
# import json
# import redis
#
# class RedisStore:
#     def __init__(self, url: str):
#         self.r = redis.from_url(url)
#
#     def get(self, session_id: str) -> list[dict]:
#         raw = self.r.get(f"session:{session_id}")
#         return json.loads(raw) if raw else []
#
#     def append(self, session_id: str, role: str, content: str) -> None:
#         history = self.get(session_id)
#         history.append({"role": role, "content": content})
#         history = history[-(settings.MAX_HISTORY_TURNS * 2):]
#         self.r.set(f"session:{session_id}", json.dumps(history), ex=60 * 60 * 6)

store = InMemoryStore()
