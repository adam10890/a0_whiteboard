# AGENTS.md — a0_whiteboard

**Version:** 0.4.1 | **Target:** Agent Zero v1.15–v1.17

## What this plugin does

Adds a collaborative canvas surface to Agent Zero's Right Canvas panel. The agent draws shapes via the `whiteboard` tool; a Socket.IO connection (`/whiteboard` namespace) pushes updates to the browser in real time. Boards persist to `usr/workdir/whiteboard_boards/`.

## Key files

| Path | Role |
|---|---|
| `plugin.yaml` | Manifest — name, version, settings section |
| `tools/whiteboard.py` | `Whiteboard(Tool)` — 7 actions the agent calls |
| `helpers/whiteboard.py` | `SharedWhiteboardManager` singleton — all state lives here |
| `api/ws_whiteboard.py` | Socket.IO `/whiteboard` namespace handler |
| `api/whiteboard_*.py` | REST endpoints (clear, list, load, save) |
| `extensions/python/` | `right_canvas_register_surfaces` hook |
| `webui/engines/tldraw-engine.html` | tldraw iframe (default engine, loads from esm.sh) |
| `webui/engines/canvas.html` | HTML5 fallback (offline-safe) |
| `webui/main.html` | Panel shell — engine switcher |

## Tool: `whiteboard`

All calls return `Response(message=..., break_loop=False)`.

| Action | Key args | Notes |
|---|---|---|
| `status` | — | Board name + shape count |
| `describe` | — | Human-readable shape list |
| `create` | `shapes[]`, or `shape`, or `text`+`x`+`y` | Adds shapes; broadcasts `whiteboard_intent` |
| `clear` | — | Removes all shapes; broadcasts event |
| `save` | `board_name` (opt) | Persists to `usr/workdir/whiteboard_boards/` |
| `load` | `board_name` (required) | Restores board; broadcasts `whiteboard_state_change` |
| `list_boards` | — | Returns list with shape counts |

## Internal import path

```python
from usr.plugins.a0_whiteboard.helpers.whiteboard import get_shared_manager
```

## How to add a tool action

1. Add `elif action == "my_action":` in `Whiteboard.execute()`.
2. Call manager method + optionally `await manager.broadcast_event(event_name, payload)`.
3. Return `Response(message=..., break_loop=False)`.

## How to add a REST endpoint

Add `api/whiteboard_<name>.py` — A0 auto-discovers all files in `api/`.

## Right Canvas registration

`extensions/python/` calls `right_canvas_register_surfaces` with `icon` + `title`. Without this the surface does not appear in the panel picker.

## Constraints

- Boards storage is outside the plugin dir (`usr/workdir/whiteboard_boards/`) — never write board data inside the plugin tree.
- Agent canvas auto-open is opt-in (v1.16+): use `pendingAttention` signal, do NOT force-focus.
- The HTML5 engine is the only offline-safe option — tldraw requires esm.sh on first load.
