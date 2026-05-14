"""Whiteboard Context Extension - Adds whiteboard state to agent system prompt."""
from __future__ import annotations
from typing import Any

try:
    from helpers.extension import Extension
except ImportError:
    from python.helpers.extension import Extension  # type: ignore


class WhiteboardContext(Extension):
    """Extension to add whiteboard context to agent's system prompt."""

    async def execute(self, system_prompt: list[str] = [], **kwargs: Any) -> None:
        whiteboard_context = await self._get_whiteboard_context()
        if whiteboard_context:
            system_prompt.append(whiteboard_context)

    async def _get_whiteboard_context(self) -> str:
        """Build whiteboard context string for system prompt."""
        try:
            try:
                from usr.plugins.a0_whiteboard.helpers.whiteboard import get_shared_manager
            except ImportError:
                import sys, os
                _helpers = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    "helpers",
                )
                if _helpers not in sys.path:
                    sys.path.insert(0, _helpers)
                from whiteboard import get_shared_manager  # type: ignore

            manager = get_shared_manager()
            status = await manager.get_status()
            shapes = manager.state.shapes

            sections: list[str] = []
            sections.append("## 🎨 Whiteboard Canvas")
            sections.append(f"**Status:** {status['shapes_count']} shape(s) on canvas")
            if status.get("current_board"):
                sections.append(f"**Current Board:** {status['current_board']}")

            if shapes:
                sections.append("\n**Current Shapes:**")
                for i, shape in enumerate(shapes[:10], 1):
                    shape_type = str(shape.type)
                    text = shape.props.text if shape.props else ""
                    desc = f"{i}. {shape_type.capitalize()} at ({int(shape.x)}, {int(shape.y)})"
                    if text:
                        desc += f" - text: '{text}'"
                    sections.append(desc)
                if len(shapes) > 10:
                    sections.append(f"... and {len(shapes) - 10} more shapes")
            else:
                sections.append("\n_The whiteboard is currently empty._")

            sections.append("\n**How to interact:**")
            sections.append("- Use the `whiteboard` tool with action `create` to draw shapes")
            sections.append("- Use action `describe` to get full description of all shapes")
            sections.append("- Use action `status` to get board summary")
            sections.append("- Use action `clear` to remove all shapes")
            sections.append("- Use action `save` / `load` to persist boards")

            return "\n".join(sections)

        except Exception:
            # If whiteboard is not available, silently skip
            return ""
