from helpers.api import ApiHandler
from flask import Request


class WhiteboardList(ApiHandler):
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
            boards = await manager.list_boards()
            return {"success": True, "boards": boards}
        except Exception as e:
            return {"success": False, "error": str(e), "boards": []}
