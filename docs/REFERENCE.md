# a0_whiteboard — Reference

**Version:** 0.4.1 | Agent Zero v1.15–v1.17

## Overview

Collaborative whiteboard in the Agent Zero Right Canvas panel. Dual rendering engine — tldraw (full editor) or HTML5 canvas (offline fallback). Real-time agent→browser sync over Socket.IO.

## Installation

```bash
# Option A — ZIP upload via GUI
# Settings → Plugins → Upload ZIP

# Option B — manual
docker cp ./a0_whiteboard <container>:/a0/usr/plugins/a0_whiteboard
```

## Tool API

Tool name: `whiteboard`

### status
```json
{"tool_name":"whiteboard","tool_args":{"action":"status"}}
```

### describe
```json
{"tool_name":"whiteboard","tool_args":{"action":"describe"}}
```

### create
```json
{
  "tool_name": "whiteboard",
  "tool_args": {
    "action": "create",
    "shapes": [
      {"type":"rect","x":10,"y":10,"w":200,"h":100,"props":{"text":"Hello"}},
      {"type":"text","x":50,"y":150,"props":{"text":"Note"}}
    ]
  }
}
```

Shorthand (single text shape):
```json
{"tool_name":"whiteboard","tool_args":{"action":"create","text":"Quick note","x":100,"y":100}}
```

### clear
```json
{"tool_name":"whiteboard","tool_args":{"action":"clear"}}
```

### save / load
```json
{"tool_name":"whiteboard","tool_args":{"action":"save","board_name":"sprint_plan"}}
{"tool_name":"whiteboard","tool_args":{"action":"load","board_name":"sprint_plan"}}
```

### list_boards
```json
{"tool_name":"whiteboard","tool_args":{"action":"list_boards"}}
```

## REST API

| Method | Path | Description |
|---|---|---|
| `GET` | `/plugins/a0_whiteboard/boards` | List saved boards |
| `POST` | `/plugins/a0_whiteboard/save` | Save current board |
| `POST` | `/plugins/a0_whiteboard/load` | Load a named board |
| `DELETE` | `/plugins/a0_whiteboard/clear` | Clear canvas |

## WebSocket

Namespace: `/whiteboard`

The panel subscribes to this namespace. When the agent draws, the server emits:
- `whiteboard_intent` — incremental change (create/clear)
- `whiteboard_state_change` — full state reload (load)

## Engine switching

The `<select>` in the panel header switches between engines. State is preserved across switches.

| Engine | Use when |
|---|---|
| tldraw | Normal use — full editor, undo/redo |
| HTML5 | Offline / lightweight fallback |

## Storage

Boards: `usr/workdir/whiteboard_boards/<name>.json`
