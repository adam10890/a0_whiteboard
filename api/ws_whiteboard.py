"""WebSocket handler for the /whiteboard namespace.

Events handled:
  whiteboard_request_state  → emit whiteboard_initial_state back to caller
  whiteboard_state_change   → broadcast to all other clients in namespace
  whiteboard_intent         → broadcast agent-driven intent to all clients
"""
from helpers.ws import WsHandler


class WsWhiteboard(WsHandler):

    async def process(self, event: str, data: dict, sid: str) -> dict | None:
        try:
            from usr.plugins.a0_whiteboard.helpers.whiteboard import get_shared_manager, build_state_snapshot
        except ImportError:
            from usr.plugins.a0_whiteboard.helpers.manager_access import get_shared_manager, build_state_snapshot
        manager = get_shared_manager()

        if event == "whiteboard_request_state":
            snapshot = build_state_snapshot(manager)
            await self.emit_to(sid, "whiteboard_initial_state", snapshot)
            return None

        if event == "whiteboard_state_change":
            update = {}
            if "shapes" in data:
                update["shapes"] = data.get("shapes") or []
            if "dataUrl" in data:
                update["dataUrl"] = data.get("dataUrl") or ""
            if update:
                await manager.apply_state(update)
            snapshot = build_state_snapshot(manager)
            await self.broadcast("whiteboard_state_change", snapshot, exclude_sids=sid)
            return None

        if event == "whiteboard_intent":
            await self.broadcast("whiteboard_intent", data)
            return None

        return None
