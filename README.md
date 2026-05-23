# a0_whiteboard

> Collaborative whiteboard for Agent Zero v1.15. Registers as a built-in
> surface in the **Right Canvas** (alongside `_browser`, `_office`,
> `_desktop`). Dual engine: **tldraw** (primary) and **HTML5 canvas**
> (fallback), switchable from the panel header. Real-time agent sync via
> Socket.IO `/whiteboard` namespace. Boards persist to
> `usr/workdir/whiteboard_boards/`.

**Version:** 0.4.0

## What it gives the agent

A second visual platform (next to the browser) for talking back to the
user — diagrams, sketches, layouts, status boards, anything spatial.
The agent draws via the `whiteboard` tool; the surface auto-focuses when
the agent makes changes so the user sees the update immediately.

## Where it lives

The whiteboard appears in the Right Canvas surface picker. Docked
(`canvas` mode) for working alongside chat, or popped out (`modal` mode)
when full-screen attention is needed. There is no floating overlay
button — the chat-input launcher from earlier versions was removed in
0.4.0.

## Engines

| Engine | When to use |
| ------ | ----------- |
| **tldraw** (default) | Full editor — shapes, undo/redo, multi-select, native drawing tools. Loads from `esm.sh` (needs internet on first load; cacheable). |
| **HTML5** | Lightweight fallback. Pure built-in `canvas.html` — no external dependencies. Use when working offline. |

Switch between engines from the engine `<select>` in the panel header.
State is preserved across switches: the new engine rehydrates from the
server's current shape list.

## Installation

### Option A: Upload ZIP
1. Open Agent Zero GUI → **Settings → Plugins**
2. Click **Upload ZIP** → select `a0_whiteboard.zip`

### Option B: Git (private repo)
1. **Settings → Plugins → Install from Git**
2. Enter the repo URL and your Personal Access Token

### Option C: Manual copy
```bash
docker cp ./a0_whiteboard <container>:/a0/usr/plugins/a0_whiteboard
```

## Documentation

- [`docs/COMP_WHITEBOARD.md`](docs/COMP_WHITEBOARD.md) — component spec
- [`docs/TLDRAW_FUTURE.md`](docs/TLDRAW_FUTURE.md) — earlier container-based tldraw plan (now superseded by the in-iframe ESM approach in `webui/engines/tldraw-engine.html`)
- [`docs/skill/SKILL.md`](docs/skill/SKILL.md) — agent skill reference
