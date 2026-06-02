from helpers.api import ApiHandler
from flask import Request


class WhiteboardLoad(ApiHandler):
    async def process(self, input: dict, request: Request) -> dict:
        try:
            try:
                from usr.plugins.a0_whiteboard.helpers.whiteboard import get_shared_manager, build_state_snapshot
            except ImportError:
                from usr.plugins.a0_whiteboard.helpers.manager_access import get_shared_manager, build_state_snapshot
            manager = get_shared_manager()
            name = (input.get("data") or {}).get("name", "")
            if not name:
                return {"success": False, "error": "name is required"}
            result = await manager.load_board(name)
            if result.success:
                await manager.broadcast_event(
                    "whiteboard_state_change",
                    build_state_snapshot(manager),
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
