# a0_whiteboard

> Floating canvas whiteboard panel. HTML5 canvas with real-time agent sync via WebSocket /whiteboard. Agent can draw shapes; save/load boards to work/whiteboard/boards/. Upgrade path to tldraw available via docs/TLDRAW_FUTURE.md.

**Version:** 0.2.0

## Installation

### Option A: Upload ZIP (easiest)
1. Open Agent Zero GUI
2. Go to **Settings → Plugins**
3. Click **Upload ZIP**
4. Select `a0_whiteboard.zip`

### Option B: Git (private repo)
1. Open Agent Zero GUI
2. Go to **Settings → Plugins → Install from Git**
3. Enter the repo URL and your Personal Access Token

### Option C: Manual copy
```bash
# Copy plugin folder to any Agent Zero container
docker cp ./a0_whiteboard <container>:/a0/usr/plugins/a0_whiteboard
```

## Documentation

- [`docs/COMP_WHITEBOARD.md`](docs/COMP_WHITEBOARD.md)
- [`docs/skill/SKILL.md`](docs/skill/SKILL.md) — Agent skill reference
