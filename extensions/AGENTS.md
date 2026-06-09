# DOX contract - a0_whiteboard/extensions

## Purpose

Agent Zero extension hooks that register or expose Whiteboard surfaces.

## Ownership

- Extensions integrate the plugin with Agent Zero lifecycle/UI hooks.
- They must not own board persistence or drawing business logic.

## Local Contracts

- Hooks should fail softly and avoid breaking the agent loop.

## Work Guidance

- Keep registration paths aligned with Agent Zero Right Canvas conventions.

## Verification

- Run `python -m py_compile` on touched Python extension files.
- Inspect changed web extension registrations.

## Child DOX Index

No child AGENTS.md files yet.
