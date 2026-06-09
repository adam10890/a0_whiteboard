# DOX contract - a0_whiteboard/api

## Purpose

HTTP/API wrappers for board state, save/load, and UI integration.

## Ownership

- APIs should stay thin over helper state logic.

## Local Contracts

- Validate board names and payload shape before state writes.
- Return explicit errors for unavailable optional surfaces.

## Work Guidance

- Keep API route names aligned with webui callers.

## Verification

- Run `python -m py_compile` on touched API files.
- Inspect matching frontend calls.

## Child DOX Index

No child AGENTS.md files yet.
