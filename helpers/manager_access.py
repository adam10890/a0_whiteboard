"""Canonical import path for the shared WhiteboardManager singleton."""
from __future__ import annotations


def get_shared_manager():
    from usr.plugins.a0_whiteboard.helpers.whiteboard import get_shared_manager as _get

    return _get()


def build_state_snapshot(manager):
    from usr.plugins.a0_whiteboard.helpers.whiteboard import build_state_snapshot as _build

    return _build(manager)
