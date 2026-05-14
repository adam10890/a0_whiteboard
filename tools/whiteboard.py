"""
whiteboard tool — agent drawing and whiteboard management.

Usage in agent JSON:
  {
    "tool_name": "whiteboard",
    "tool_args": {
      "action": "create",
      "shapes": [
        {"type": "rect", "x": 10, "y": 10, "w": 200, "h": 100, "props": {"text": "Hello"}}
      ]
    }
  }

Available actions:
  status        — current board name and shape count
  describe      — human-readable list of shapes on the board
  create        — add shapes (via 'shapes', 'shape', or 'text')
  clear         — remove all shapes
  save          — persist current board to disk
  load          — restore a saved board
  list_boards   — list all saved boards
"""
from __future__ import annotations
import logging

try:
    from helpers.tool import Tool, Response
except ImportError:
    from python.helpers.tool import Tool, Response  # type: ignore

logger = logging.getLogger(__name__)


class Whiteboard(Tool):
    """Manage the shared whiteboard canvas: create shapes, inspect state, save/load boards."""

    async def execute(self, **kwargs) -> Response:
        await self.agent.handle_intervention()

        action = (self.args.get("action") or "status").lower()
        board_name = self.args.get("board_name", "")
        shapes = self.args.get("shapes", [])
        shape_data = self.args.get("shape", {})
        text = self.args.get("text", "")
        x = float(self.args.get("x", 50))
        y = float(self.args.get("y", 50))

        try:
            from usr.plugins.a0_whiteboard.helpers.whiteboard import get_shared_manager
            manager = get_shared_manager()
        except Exception as exc:
            logger.error("Whiteboard manager import failed: %s", exc)
            return Response(message=f"Whiteboard not available: {exc}", break_loop=False)

        if action == "status":
            status = await manager.get_status()
            return Response(
                message=f"Whiteboard '{manager.current_board_name}': {status['shapes_count']} shape(s).",
                break_loop=False,
                additional={"status": status, "shapes": manager.get_shapes()},
            )

        elif action == "describe":
            shapes_list = manager.get_shapes()
            if not shapes_list:
                return Response(message="The whiteboard is empty.", break_loop=False)
            lines = [f"Whiteboard '{manager.current_board_name}' has {len(shapes_list)} shape(s):"]
            for i, s in enumerate(shapes_list, 1):
                lines.append(f"  {i}. {s['type']} at ({s['x']}, {s['y']})")
                if s.get("props", {}).get("text"):
                    lines.append(f"      text: '{s['props']['text']}'")
            return Response(message="\n".join(lines), break_loop=False)

        elif action == "create":
            incoming = []
            if shapes:
                incoming = shapes if isinstance(shapes, list) else [shapes]
            elif shape_data:
                incoming = [shape_data]
            elif text:
                incoming = [{"type": "text", "x": x, "y": y, "props": {"text": text}}]
            if not incoming:
                return Response(
                    message="No shapes provided. Use 'shapes', 'shape', or 'text'.",
                    break_loop=False,
                )

            result = await manager.create_shapes(incoming)
            if result.success:
                created_shapes = manager.get_shapes()[-result.count:] if result.count else []
                await manager.broadcast_event(
                    "whiteboard_intent",
                    {
                        "action": "create_shapes",
                        "data": {"shapes": created_shapes},
                        "metadata": {"source": "agent"},
                    },
                )
                return Response(
                    message=f"Created {result.count} shape(s) on whiteboard '{manager.current_board_name}'.",
                    break_loop=False,
                    additional={"count": result.count, "shapes": manager.get_shapes()},
                )
            return Response(message=f"Failed to create shapes: {result.error}", break_loop=False)

        elif action == "clear":
            result = await manager.clear_canvas()
            if result.success:
                await manager.broadcast_event(
                    "whiteboard_intent",
                    {"action": "clear_canvas", "data": {}, "metadata": {"source": "agent"}},
                )
            return Response(
                message=f"Cleared {result.count} shape(s) from whiteboard '{manager.current_board_name}'.",
                break_loop=False,
                additional={"cleared_count": result.count},
            )

        elif action == "save":
            target = board_name or manager.current_board_name
            result = await manager.save_board(target if target else None)
            if result.success:
                return Response(
                    message=f"Saved board '{manager.current_board_name}' ({result.count} shapes).",
                    break_loop=False,
                )
            return Response(message=f"Save failed: {result.error}", break_loop=False)

        elif action == "load":
            if not board_name:
                return Response(message="Board name is required for 'load'.", break_loop=False)
            result = await manager.load_board(board_name)
            if result.success:
                await manager.broadcast_event(
                    "whiteboard_state_change",
                    {"state": manager.state.model_dump()},
                )
                return Response(
                    message=f"Loaded board '{manager.current_board_name}' ({result.count} shapes).",
                    break_loop=False,
                    additional={"count": result.count, "shapes": manager.get_shapes()},
                )
            return Response(message=f"Load failed: {result.error}", break_loop=False)

        elif action == "list_boards":
            boards = await manager.list_boards()
            if not boards:
                return Response(message="No saved boards found.", break_loop=False)
            lines = ["Saved boards:"]
            for b in boards:
                lines.append(f"  - {b['name']} ({b['shape_count']} shapes)")
            return Response(message="\n".join(lines), break_loop=False)

        else:
            return Response(
                message=(
                    f"Unknown action: '{action}'. "
                    "Available: status, describe, create, clear, save, load, list_boards."
                ),
                break_loop=False,
            )
