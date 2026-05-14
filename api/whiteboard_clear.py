from helpers.api import ApiHandler
from flask import Request


class WhiteboardClear(ApiHandler):
    async def process(self, input: dict, request: Request) -> dict:
        try:
            try:
                from usr.plugins.a0_whiteboard.helpers.whiteboard import get_shared_manager
            except ImportError:
                import sys, os
                _helpers = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "helpers")
                if _helpers not in sys.path:
                    sys.path.insert(0, _helpers)
                from whiteboard import get_shared_manager  # type: ignore
            manager = get_shared_manager()
            result = await manager.clear_canvas()
            if result.success:
                await manager.broadcast_event(
                    "whiteboard_intent",
                    {"action": "clear_canvas", "data": {}, "metadata": {"source": "agent"}},
                )
            return {"success": result.success, "count": result.count, "error": result.error}
        except Exception as e:
            return {"success": False, "error": str(e)}
