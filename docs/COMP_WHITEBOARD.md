# Component: Whiteboard System

## Overview

| Field | Value |
| ----- | ----- |
| **Component ID** | `COMP-WB` |
| **Status** | Active — deployed to container `a0-v098` |
| **Category** | Visual Collaboration & Diagramming |
| **Migration Target** | `usr/plugins/a0_whiteboard/` |
| **Migration Action** | **KEEP** — package as v1.7 plugin |

## Purpose & Value

The Whiteboard provides a visual collaboration canvas integrated with Agent Zero. The agent can create, modify, and analyze diagrams. It supports multiple boards, vision analysis, and real-time sync via WebSocket.

### External Dependencies

| Dependency | Current Version | Latest Available | Notes |
| ---------- | --------------- | ---------------- | ----- |
| **tldraw** | ^3.0.0 | **4.5.7** (2026-04-03) | ⚠️ Major version — v4.x has breaking API changes |
| **react** | ^18.2.0 | **19.x** | tldraw v3.8+ supports React 19 |
| **vite** | ^5.0.0 | **6.x** | Consider upgrading with tldraw |
| **tailwindcss** | ^3.3.5 | **4.x** | New architecture in v4 |

> See [EXTERNAL_DEPENDENCIES.md](EXTERNAL_DEPENDENCIES.md) for full version registry.

**Key value propositions:**

- **Visual diagramming** — agent can create Mermaid/ASCII diagrams on a canvas
- **Multi-board support** — multiple named whiteboards for different projects
- **Vision analysis** — analyze screenshots/images placed on the whiteboard
- **Real-time sync** — WebSocket-based live updates to the UI
- **Context injection** — whiteboard content injected into system prompt

## File Inventory

### Core Helpers (`helpers/whiteboard/`)

| File | Role |
| ---- | ---- |
| `__init__.py` | Package init |
| `manager.py` | Whiteboard manager — CRUD operations |
| `types.py` | Type definitions for whiteboard objects |
| `ag_ui_bridge.py` | Bridge between agent and UI |
| `vision_analyzer.py` | Vision/image analysis on whiteboard content |

### Proxy

| File | Role |
| ---- | ---- |
| `helpers/whiteboard_proxy.py` | Proxy layer for whiteboard access |

### Tool

| File | Role |
| ---- | ---- |
| `tools/whiteboard.py` | Agent tool for whiteboard operations |
| `prompts/agent.system.tool.whiteboard.md` | Tool prompt documentation |
| `prompts/agent.system.tool.whiteboard_bridge.md` | Bridge tool prompt |
| `prompts/agent.system.tool.whiteboard_status.md` | Status tool prompt |

### Extensions

| File | Hook Point | Role |
| ---- | ---------- | ---- |
| `python/extensions/agent_init/_30_whiteboard_init.py` | `agent_init` | Initialize whiteboard on agent startup |
| `python/extensions/system_prompt/_40_whiteboard_context.py` | `system_prompt` | Inject whiteboard context into system prompt |

### API Endpoints

| File | Route | Role |
| ---- | ----- | ---- |
| `api/whiteboard_boards.py` | `/whiteboard/boards` | List boards |
| `api/whiteboard_clear.py` | `/whiteboard/clear` | Clear board |
| `api/whiteboard_delete.py` | `/whiteboard/delete` | Delete board |
| `api/whiteboard_list.py` | `/whiteboard/list` | List contents |
| `api/whiteboard_load.py` | `/whiteboard/load` | Load board |
| `api/whiteboard_save.py` | `/whiteboard/save` | Save board |
| `api/whiteboard_status.py` | `/whiteboard/status` | Board status |

### WebSocket Handler

| File | Role |
| ---- | ---- |
| `python/websocket_handlers/whiteboard_handler.py` | Real-time whiteboard sync |

### Web UI

| File | Role |
| ---- | ---- |
| `webui/components/whiteboard/whiteboard-panel.html` | Whiteboard UI panel |
| `webui/components/whiteboard/whiteboard-store.js` | Whiteboard state store |

### Skills

| File | Role |
| ---- | ---- |
| `skills/whiteboard/config/whiteboard.yaml` | Whiteboard skill config |
| `skills/whiteboard/docs/WHITEBOARD_TASKS.md` | Whiteboard task examples |

### Configuration

| File | Role |
| ---- | ---- |
| `docker-compose.whiteboard.yml` | Docker compose for whiteboard service |
| `start_whiteboard.bat` | Windows start script |

### Data

| File | Role |
| ---- | ---- |
| `work/whiteboard_boards/` | Saved whiteboard boards |

### Tests

| Location | Contents |
| -------- | -------- |
| `tests_suite/unit_tests/whiteboard/` | Unit tests |

### Documentation

| File | Purpose |
| ---- | ------- |
| `docs/whiteboard extension/PHASE_2_WHITEBOARD_SERVICE.md` | Service design |
| `docs/whiteboard extension/PHASE_2_2_WHITEBOARD_MANAGER.md` | Manager design |
| `docs/whiteboard extension/PHASE_2_3_WHITEBOARD_TOOL.md` | Tool design |
| `docs/whiteboard extension/Whiteboard Extension Integration Walkthrough.md` | Integration walkthrough |
| `work/WHITEBOARD_MIGRATION_SPEC.md` | Migration spec |

## Architecture

```text
Agent Tool (whiteboard.py)
    │
    ├── manager.py ──→ CRUD on boards (files in work/whiteboard_boards/)
    ├── vision_analyzer.py ──→ Analyze images on board
    └── ag_ui_bridge.py ──→ Push updates to UI
                                  │
                                  ▼
                        whiteboard_handler.py (WebSocket)
                                  │
                                  ▼
                        whiteboard-panel.html + whiteboard-store.js (UI)
```

## Migration Notes

- All files package into `usr/plugins/a0_whiteboard/`
- API endpoints need adaptation for v1.7 API routing system (`register_api_route`)
- WebSocket handler needs adaptation for v1.7 WebSocket system
- WebUI components move to plugin `webui/` directory
- Board data stays in `work/whiteboard_boards/` or moves to `usr/data/whiteboard/`

## Related Documents

- [Development Plan](../migration/DEVELOPMENT_PLAN_A0_ROUTER.md) — Section 3 (KEEP components)
- [COMP: WebSocket Handlers](COMP_WEBSOCKET_HANDLERS.md) — whiteboard handler is part of WS system
