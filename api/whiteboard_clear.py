from helpers.api import ApiHandler
from flask import Request


class WhiteboardClear(ApiHandler):
    async def process(self, input: dict, request: Request) -> dict:
        try:
            try:
                from usr.plugins.a0_whiteboard.helpers.whiteboard import get_shared_manager, build_state_snapshot
            except ImportError:
                from usr.plugins.a0_whiteboard.helpers.manager_access import get_shared_manager, build_state_snapshot
            manager = get_shared_manager()
            result = await manager.clear_canvas()
            if result.success:
                await manager.broadcast_event(
                    "whiteboard_intent",
                    {"action": "clear_canvas", "data": {}, "metadata": {"source": "agent"}},
                )
                await manager.broadcast_event(
                    "whiteboard_state_change",
                    build_state_snapshot(manager),
                )
            return {"success": result.success, "count": result.count, "error": result.error}
        except Exception as e:
            return {"success": False, "error": str(e)}
