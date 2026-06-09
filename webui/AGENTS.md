# DOX contract - a0_whiteboard/webui

## Purpose

Right Canvas whiteboard UI assets and engine-specific frontend code.

## Ownership

- UI renders and edits board state; helpers/API own persistence semantics.
- Static UI assets belong here. Saved boards do not.

## Local Contracts

- Preserve explicit user focus behavior for Right Canvas surfaces.
- Keep tldraw and HTML5 fallback behavior aligned enough for core actions.

## Work Guidance

- Avoid hard-coded viewport assumptions; the canvas must work in narrow panels
  and full workspace layouts.

## Verification

- Inspect changed HTML/JS wiring and route names.

## Child DOX Index

No child AGENTS.md files yet.
