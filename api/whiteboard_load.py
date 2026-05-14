from helpers.api import ApiHandler
from flask import Request


class WhiteboardLoad(ApiHandler):
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
            name = (input.get("data") or {}).get("name", "")
            if not name:
                return {"success": False, "error": "name is required"}
            result = await manager.load_board(name)
            if result.success:
                await manager.broadcast_event(
                    "whiteboard_state_change",
                    {"state": manager.state.model_dump()},
                )
            return {
                "success": result.success,
                "name": manager.current_board_name,
                "count": result.count,
                "error": result.error,
                "state": manager.state.model_dump() if result.success else None,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
