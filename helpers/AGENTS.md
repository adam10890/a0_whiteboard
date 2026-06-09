# DOX contract - a0_whiteboard/helpers

## Purpose

Board state, serialization, persistence, and broadcast helpers.

## Ownership

- Helpers own the canonical board model used by tools, APIs, and UI.
- Saved boards are runtime data and must stay outside plugin source.

## Local Contracts

- Keep serialization backward-compatible with existing saved boards where
  practical.
- Broadcast helpers must not assume the UI is mounted.

## Work Guidance

- Route tool/API/webui behavior through shared helpers when board state changes.

## Verification

- Run `python -m py_compile` on touched helper files.

## Child DOX Index

No child AGENTS.md files yet.
