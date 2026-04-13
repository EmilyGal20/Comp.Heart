import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket


class RealtimeManager:
    def __init__(self):
        self.connections: dict[int, dict[str, Any]] = {}
        self._next_id = 1
        self.loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop

    async def connect(
        self,
        websocket: WebSocket,
        *,
        user_id: int,
        organization_id: int | None,
        role: str,
        scope_organization_id: int | None = None,
    ) -> int:
        await websocket.accept()
        connection_id = self._next_id
        self._next_id += 1
        self.connections[connection_id] = {
            "websocket": websocket,
            "user_id": user_id,
            "organization_id": organization_id,
            "role": role,
            "scope_organization_id": scope_organization_id,
        }
        return connection_id

    def disconnect(self, connection_id: int):
        self.connections.pop(connection_id, None)

    def _matches(self, connection: dict[str, Any], organization_id: int | None, user_id: int | None) -> bool:
        if user_id is not None and connection["user_id"] == user_id:
            return True
        if connection["role"] == "SUPER_ADMIN":
            scoped_org_id = connection.get("scope_organization_id")
            if organization_id is None:
                return True
            return scoped_org_id in {None, organization_id}
        if organization_id is None:
            return False
        if connection["organization_id"] != organization_id:
            return False
        if user_id is None:
            return True
        return connection["user_id"] == user_id

    async def _broadcast(self, payload: dict[str, Any], organization_id: int | None = None, user_id: int | None = None):
        stale_ids = []
        for connection_id, connection in list(self.connections.items()):
            if not self._matches(connection, organization_id, user_id):
                continue
            try:
                await connection["websocket"].send_json(payload)
            except Exception:
                stale_ids.append(connection_id)
        for stale_id in stale_ids:
            self.disconnect(stale_id)

    def publish(self, event_type: str, data: dict[str, Any], *, organization_id: int | None = None, user_id: int | None = None):
        payload = {
            "event_type": event_type,
            "organization_id": organization_id,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        if not self.loop:
            return
        asyncio.run_coroutine_threadsafe(self._broadcast(payload, organization_id=organization_id, user_id=user_id), self.loop)


realtime_manager = RealtimeManager()


def publish_event(event_type: str, data: dict[str, Any], *, organization_id: int | None = None, user_id: int | None = None):
    realtime_manager.publish(event_type, data, organization_id=organization_id, user_id=user_id)


def summarize_activity_stream(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        grouped[event.get("event_type", "system")].append(event)
    summary = []
    for event_type, entries in grouped.items():
        latest = entries[-1]
        summary.append(
            {
                "event_type": event_type,
                "count": len(entries),
                "latest_message": latest.get("data", {}).get("message") or latest.get("data", {}).get("title") or event_type,
                "organization_id": latest.get("organization_id"),
                "timestamp": latest.get("timestamp"),
            }
        )
    return sorted(summary, key=lambda item: item.get("timestamp") or "", reverse=True)
