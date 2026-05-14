# tldraw Upgrade Guide

The `a0_whiteboard` plugin currently ships with a **built-in HTML5 canvas** (`webui/canvas.html`).
This document explains how to replace it with [tldraw](https://tldraw.dev) for a fully-featured vector drawing experience.

## Why a separate container?

tldraw v2+ requires a React/Vite build. Running a Node.js build process inside the
Python/Flask agent-zero container is fragile. A separate container keeps concerns separate
and avoids Node.js licensing complexity.

> **License note:** tldraw v2.x uses a custom license (tldraw License).
> Commercial use may require a paid license. Review https://tldraw.dev/community/license
> before deploying publicly.

---

## Architecture

```
┌─────────────────────────┐      iframe      ┌──────────────────────┐
│  agent-zero container   │ ◄──────────────► │  tldraw container    │
│  port 50001 (WebUI)     │  postMessage     │  port 4173 (Vite)    │
│                         │                  │                       │
│  /whiteboard/ proxy ────┼──────────────────┤  tldraw React app    │
└─────────────────────────┘                  └──────────────────────┘
```

---

## Step 1 — Build the tldraw app

```bash
# In a separate directory outside the agent-zero workspace
npx create-tldraw-app@latest wb-app --template vite
cd wb-app
npm install
npm run build
# Output: dist/
```

Add postMessage bridge code to `src/App.tsx`:

```tsx
import { Tldraw, useEditor } from 'tldraw'
import 'tldraw/tldraw.css'
import { useEffect } from 'react'

function Bridge() {
  const editor = useEditor()
  useEffect(() => {
    window.parent.postMessage({ type: 'whiteboard:iframe_ready' }, '*')

    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'whiteboard:intent') {
        // handle agent intents
      }
    }
    window.addEventListener('message', handler)

    const unsub = editor.store.listen(() => {
      window.parent.postMessage({
        type: 'whiteboard:state_change',
        shapes: editor.getCurrentPageShapes(),
      }, '*')
    }, { scope: 'document' })

    return () => { window.removeEventListener('message', handler); unsub() }
  }, [editor])
  return null
}

export default function App() {
  return <Tldraw><Bridge /></Tldraw>
}
```

---

## Step 2 — Dockerfile for tldraw container

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 4173
```

---

## Step 3 — docker-compose.yml additions

```yaml
services:
  agent-zero:
    # ... existing config ...
    depends_on:
      - tldraw

  tldraw:
    build: ./tldraw-app
    ports:
      - "4173:80"
    networks:
      - a0_network
```

---

## Step 4 — Update plugin to use tldraw

In `whiteboard-store.js`, `iframeUrl` is already `/whiteboard/`.

Add a reverse proxy rule to the agent-zero container (or nginx sidecar):

```nginx
location /whiteboard/ {
    proxy_pass http://tldraw:80/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
}
```

Alternatively, change `iframeUrl` directly to `http://localhost:4173` if running locally.

---

## Step 5 — Revert canvas.html

Once tldraw is working, update `main.html` to restore the dynamic `iframeUrl`:

```html
<iframe :src="$store.whiteboard.iframeUrl" ...>
```

And update `whiteboard-store.js` `init()`:

```js
this.iframeUrl = '/whiteboard/';
```
