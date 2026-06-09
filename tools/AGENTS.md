# DOX contract - a0_whiteboard/tools

## Purpose

Agent-facing drawing and board manipulation tools.

## Ownership

- Tools own agent command parsing and responses.
- Board mutation and persistence should route through helpers.

## Local Contracts

- Keep drawing commands deterministic and auditable.
- Do not force-open the UI unless the product contract explicitly allows it.

## Work Guidance

- Update docs/prompts when tool arguments or result fields change.

## Verification

- Run `python -m py_compile` on touched tool files.

## Child DOX Index

No child AGENTS.md files yet.
