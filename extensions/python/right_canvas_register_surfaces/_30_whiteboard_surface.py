"""
Register the whiteboard as a Right Canvas surface (Agent Zero v1.15–1.17).

Verified-as-of: Agent Zero v1.17 (May 2026)

v1.17 changes relevant to this surface:
  - Right-canvas width cap removed: the panel can shrink to zero or grow
    across the full workspace. The companion panel CSS is responsive
    (toolbar wraps; engine selector hides label at narrow widths).
  - Explicit close button added to right canvas toolbar (chrome change,
    no plugin work needed).
  - Browser/Desktop switcher buttons appear in modal headers using the
    same registered surface metadata as canvas controls; our `icon` and
    `title` fields below feed those controls.

v1.16 changes relevant to this surface:
  - "Browser and Office canvases are opt-in; Tool results no longer
    auto-open the Browser or Office canvas; explicit user actions are
    required." We follow the same convention: `autofocus_events` is
    declared below as a hint, but the store-side `requestFocus` only
    calls the canvas focus API after the user has explicitly opened the
    surface — otherwise it just flips a `pendingAttention` flag so the
    panel header pulses without stealing focus.
  - Shared surfaces frontend service (Browser + Desktop registered via
    this hook); this plugin follows the same pattern.

The metadata schema below is a best-effort signature based on A0 docs
and the patterns followed by the built-in _browser / _desktop plugins.
Before merging into production, verify the exact key names against a
running A0 v1.17 container (open one of the built-in surface plugins
under usr/plugins/_browser/extensions/python/right_canvas_register_surfaces/
and mirror the dict shape exactly). Specifically confirm:
  - panel vs panel_html vs panel_url
  - store vs store_js vs store_url
  - icon format (material-symbols name vs SVG path vs URL)
  - autofocus_events / autofocus_filter shape and whether nested keys
    like 'metadata.source' are supported
  - default_width / min_width — whether the chrome reads them or the
    surface manages its own width in localStorage

If any of those differ, adjust the dict below to match A0's contract.
The store-side autofocus path in whiteboard-store.js is intentional
belt-and-braces and degrades gracefully if `autofocus_events` is ignored.
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
    "min_width": 320,
    "order": 30,
    # Hint only — A0 v1.16+ treats canvas auto-open as opt-in. The store
    # respects that by gating its focus call on whether the user has
    # already mounted the surface.
    "autofocus_events": ["whiteboard_intent"],
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
