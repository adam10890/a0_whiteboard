---
name: "whiteboard"
description: "Interactive tldraw whiteboard for agent-user visual collaboration. Provides real-time drawing canvas with WebSocket sync, vision analysis, and agent-controlled shapes. Use when user wants to draw, diagram, sketch, or visually communicate."
version: "1.0.0"
author: "Adam"
tags: ["ui", "visual", "collaboration", "tldraw", "drawing", "diagram"]
trigger_patterns:
  - "whiteboard"
  - "draw"
  - "diagram"
  - "visual"
  - "canvas"
  - "sketch"
  - "flowchart"
priority: 4
---

# Whiteboard Skill

Interactive collaborative canvas for agent-user visual communication using tldraw.

## When to Use

Activate when the user wants to:

- Draw diagrams, flowcharts, or sketches
- Visually communicate ideas
- Create or view shapes on a shared canvas
- Analyze visual content

## Features

- Real-time drawing and shape manipulation via tldraw
- Agent can read canvas state via the `whiteboard` tool
- Agent can add shapes programmatically
- Vision analysis for understanding user drawings
- WebSocket sync between browser UI and agent backend

## Requirements

- Docker service: `whiteboard-ui` (port 5173 → 4173)
- Python backend: `/a0/python/tools/whiteboard.py`, `/a0/python/helpers/whiteboard/*`
- WebSocket handler: `/a0/python/websocket_handlers/whiteboard_handler.py`
- API endpoints: `/a0/python/api/whiteboard_*.py`

## WebSocket Integration

Whiteboard uses the new websocket_manager architecture (NOT the old Gateway on port 8001):

- Socket.IO namespace: `/whiteboard` — auto-discovered from `/a0/python/websocket_handlers/whiteboard_handler.py`
- Events: `whiteboard_state_change`, `whiteboard_intent`, `whiteboard_request_state`
- All WebSocket traffic runs on the main Agent Zero server port (50080 external / 80 in Docker)
- Client connects via `getNamespacedClient('/whiteboard')` from `/a0/webui/js/websocket.js`
- Manager: `/a0/python/helpers/websocket_manager.py`
- Discovery: `/a0/python/helpers/websocket_namespace_discovery.py`

## Usage

### For the Agent

- **Check canvas state:** Use `whiteboard` tool with action `status`
- **Add shapes:** Use `whiteboard` tool with action `add` and shape properties
- **Analyze content:** Use `whiteboard` tool with action `analyze` (vision model)
- **Clear canvas:** Use `whiteboard` tool with action `clear`

### For the User

Open the Whiteboard panel in the UI sidebar. Draw shapes, add text, and the agent will see your changes in real-time via WebSocket.

## Installation

1. Ensure Docker Compose is running:

   ```bash
   docker-compose -f docker-compose.whiteboard.yml up -d
   ```

2. The whiteboard panel should be visible in the agent UI
3. WebSocket connects automatically on panel open

## Troubleshooting

- If WebSocket fails: Check that the main server port (50080) is accessible and restart the agent container
- If shapes don't sync: Check browser console for WS errors and Docker logs
- If UI doesn't load: Verify `docker-compose.whiteboard.yml` build context points to `skills/whiteboard/ui`


## Hebrew Triggers / טריגרים בעברית
trigger_patterns_he:
  - "לוח"
  - "ציור"
  - "דיאגרמה"
  - "שרטוט"
  - "ויזואלי"
  - "לוח ציור"
  - "לוח לבן"
  - "צייר"
