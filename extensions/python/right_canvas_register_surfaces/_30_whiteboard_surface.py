"""
Register the whiteboard as a Right Canvas surface (Agent Zero v1.15).

The metadata schema below is a best-effort signature based on A0 v1.15
documentation and the patterns followed by the built-in _browser, _office,
and _desktop plugins. Before shipping, verify the exact key names and
hook directory against a running A0 v1.15 container — open one of the
built-in plugins under usr/plugins/_browser/extensions/python/ and mirror
its surface-registration extension exactly.

Specifically, confirm:
  - Hook directory name (right_canvas_register_surfaces vs alternatives).
  - Whether the hook receives a mutable list arg or returns a value.
  - Key names: panel vs panel_html, store vs store_js.
  - Icon format (material-symbols name, SVG path, or URL).
  - autofocus_events / autofocus_filter shape and whether nested keys
    like metadata.source are supported.
  - Whether default_width/min_width are read by the canvas chrome or by
    the surface itself (localStorage).

If any of those differ, adjust the dict below to match A0's contract.
The store-side autofocus fallback in whiteboard-store.js (requestFocus,
custom 'a0:right-canvas:focus' event) is intentional belt-and-braces.
"""
from __future__ import annotations
from typing import Any

try:
    from helpers.extension import Extension
except ImportError:
    from python.helpers.extension import Extension  # type: ignore


SURFACE_DEFINITION: dict[str, Any] = {
    "id": "whiteboard",
    "title": "Whiteboard",
    "icon": "draw",
    "panel": "/plugins/a0_whiteboard/webui/whiteboard-panel.html",
    "store": "/plugins/a0_whiteboard/webui/whiteboard-store.js",
    "modes": ["canvas", "modal"],
    "default_mode": "canvas",
    "default_width": 720,
    "min_width": 360,
    "order": 30,
    "autofocus_events": ["whiteboard_intent", "whiteboard_state_change"],
    "autofocus_filter": {
        "whiteboard_intent": {"metadata.source": "agent"},
    },
    "description": (
        "Collaborative whiteboard surface. Dual engine (tldraw + HTML5) "
        "with real-time agent sync via WebSocket."
    ),
}


class WhiteboardSurface(Extension):
    """Append the whiteboard surface to the Right Canvas surface registry."""

    async def execute(self, surfaces: list[dict] = [], **kwargs: Any) -> None:
        try:
            if any(isinstance(s, dict) and s.get("id") == SURFACE_DEFINITION["id"] for s in surfaces):
                return
            surfaces.append(dict(SURFACE_DEFINITION))
        except Exception:
            pass
