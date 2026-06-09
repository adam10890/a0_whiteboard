# DOX contract - a0_whiteboard

## Purpose

Collaborative Right Canvas whiteboard plugin for Agent Zero. It owns board
state helpers, agent drawing tools, WebSocket/API synchronization, and web UI
surfaces for tldraw/HTML5 canvas workflows.

## Ownership

- This folder is plugin source; saved boards and user drawings are runtime data.
- Board persistence belongs under the configured Agent Zero workdir, not plugin
  source.
- The whiteboard is an annotation/canvas surface. It should not become the
  source of truth for Pen & Paper workflows or external documents.

## Local Contracts

- `plugin.yaml:name` must stay `a0_whiteboard`.
- Helper code owns board state, serialization, and broadcast semantics.
- Tool/API/webui surfaces must share the same board model.
- Optional engines must degrade gracefully; a UI engine failure must not break
  the agent loop.

## Work Guidance

- Preserve explicit user focus rules for Right Canvas surfaces.
- Keep agent drawing commands deterministic and easy to audit.
- When another plugin sends shapes to Whiteboard, treat the result as a derived
  annotation copy, not ownership transfer.

## Verification

- Run `python -m py_compile` on touched Python files.
- For web UI changes, manually inspect the affected HTML/JS wiring and API
  route names.
- For board-state changes, verify save/load/broadcast paths stay aligned.

## Child DOX Index

- `helpers/AGENTS.md` — board state, serialization, and broadcast helpers.
- `tools/AGENTS.md` — agent-facing drawing tools.
- `api/AGENTS.md` — HTTP/WebSocket-adjacent API wrappers.
- `webui/AGENTS.md` — Right Canvas UI and engine-specific frontend code.
- `extensions/AGENTS.md` — Agent Zero registration hooks.
- `docs/AGENTS.md` — whiteboard runbooks and durable design notes.
