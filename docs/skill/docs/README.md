# tldraw Whiteboard Extension for Agent Zero

## Overview

This extension integrates an infinite canvas whiteboard (powered by [tldraw](https://tldraw.com)) into Agent Zero, allowing the agent to create, manipulate, and export visual diagrams during conversations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Zero (Python)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  python/tools/whiteboard.py                          │   │
│  │  - WhiteboardTool (inherits from Tool)               │   │
│  │  - Actions: create, update, delete, export, clear    │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  python/helpers/whiteboard/                          │   │
│  │  - manager.py: Canvas state management               │   │
│  │  - ag_ui_bridge.py: WebSocket client                │   │
│  │  - types.py: Pydantic models                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             │ WebSocket (AG-UI Protocol)
┌─────────────────────────────────────────────────────────────┐
│               Whiteboard UI (React + tldraw)                 │
│  extensions/tldraw-whiteboard/ui/                            │
│  - Renders infinite canvas                                   │
│  - Handles user interactions                                 │
│  - Syncs state bidirectionally                               │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Backend (Already Installed)

The Python backend is automatically available when Agent Zero runs:

- `python/tools/whiteboard.py` - Main tool
- `python/helpers/whiteboard/` - Helper modules
- `python/extensions/agent_init/_30_whiteboard_init.py` - Initialization hook

### 2. Frontend (React UI)

```bash
cd extensions/tldraw-whiteboard/ui

# Install dependencies
npm install

# Run development server
npm run dev
# Opens at http://localhost:5173

# Or build for production
npm run build
```

### 3. Use the Tool

The agent can now use the whiteboard tool:

```
Tool: whiteboard
Action: create
Arguments:
  task: "Draw system architecture"
  shapes:
    - id: "box1"
      type: "rectangle"
      x: 100
      y: 100
      props:
        fill: "#3b82f6"
        text: "Component A"
```

## Tool Reference

### Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| `create` | Create shapes | `shapes`, `task` |
| `update` | Update shape | `shape_id`, `props` |
| `delete` | Remove shape | `shape_id` |
| `export` | Save to file | `format` |
| `clear` | Clear canvas | - |
| `status` | Get status | - |

### Shape Types

- `rectangle` - Box/card shape
- `circle` - Circular shape
- `line` - Straight line
- `arrow` - Arrow connector
- `text` - Text label

### Color Palette

```
Primary:   #3b82f6 (Blue)
Success:   #10b981 (Green)
Warning:   #f59e0b (Amber)
Danger:    #ef4444 (Red)
Neutral:   #6b7280 (Gray)
Purple:    #a855f7
Teal:      #14b8a6
```

## Configuration

See `config/whiteboard.yaml` for configuration options.

Environment variables:
- `WHITEBOARD_ENABLED=true` - Enable/disable the extension
- `WHITEBOARD_EAGER_CONNECT=false` - Connect to UI on agent init

## Development

### Phase Documentation

Detailed implementation guides are in `docs/whiteboard extension/`:

- `PHASE_0_PLANNING.md` - Architecture and planning
- `PHASE_1_REACT_UI.md` - React UI implementation
- `PHASE_2_WHITEBOARD_SERVICE.md` - Python backend
- `PHASE_5_AGENT_INTEGRATION.md` - Agent integration
- `PHASE_6_TESTING.md` - Testing guide

### Running Tests

```bash
# Python tests
pytest tests_suite/unit_tests/whiteboard/ -v

# React tests (from ui/)
npm test
```

## License

MIT License - Same as Agent Zero
