"""Whiteboard helper — full implementation for Agent-first POC.

Provides WhiteboardManager with shapes, state, save/load, and agent/tool
integration.  Keeps the same get_shared_manager() singleton used by
extensions, API handlers, and WebSocket code.
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field, asdict, fields
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Default boards directory under the project workdir.
_DEFAULT_BOARDS_DIR = Path(os.environ.get("WHITEBOARD_BOARDS_DIR", "usr/workdir/whiteboard_boards"))

_get_ws_manager = None
_WS_EVENT_KEY = "event_type"
try:
    from helpers.ws_manager import get_shared_ws_manager as _get_ws_manager
except ImportError:
    try:
        from helpers.websocket_manager import get_shared_websocket_manager as _get_ws_manager
        _WS_EVENT_KEY = "event_name"
    except ImportError:
        _get_ws_manager = None

try:
    from helpers.ws import NAMESPACE as _WS_NAMESPACE
except ImportError:
    _WS_NAMESPACE = "/webui"


@dataclass
class OperationResult:
    """Result of an async board operation."""

    success: bool = True
    count: int = 0
    error: str = ""


@dataclass
class ShapeProps:
    """Visual properties attached to a shape."""

    text: str = ""
    color: str = "#818cf8"
    strokeWidth: int = 2
    fill: str = "transparent"
    fontSize: int = 16

    def model_dump(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Shape:
    """A single whiteboard shape."""

    id: str = ""
    type: str = "text"          # text | line | rect | ellipse | circle | arrow
    x: float = 0.0
    y: float = 0.0
    w: float = 100.0
    h: float = 60.0
    r: float = 0.0
    points: list[float] = field(default_factory=list)
    props: ShapeProps = field(default_factory=ShapeProps)

    def model_dump(self) -> dict[str, Any]:
        d = asdict(self)
        d["props"] = self.props.model_dump()
        return d


@dataclass
class WhiteboardState:
    """Current mutable state of the active board."""

    board_name: str = "default"
    shapes: list[Shape] = field(default_factory=list)
    updated_at: float = field(default_factory=time.time)
    dataUrl: str = ""          # optional raster snapshot from UI canvas

    def model_dump(self) -> dict[str, Any]:
        return {
            "board_name": self.board_name,
            "shapes": [s.model_dump() for s in self.shapes],
            "updated_at": self.updated_at,
            "dataUrl": self.dataUrl,
        }


class WhiteboardManager:
    """Full in-memory manager with async file persistence."""

    def __init__(self, boards_dir: str | Path | None = None) -> None:
        self._boards_dir = Path(boards_dir) if boards_dir else _DEFAULT_BOARDS_DIR
        self._state = WhiteboardState()
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ #
    #  Properties
    # ------------------------------------------------------------------ #

    @property
    def state(self) -> WhiteboardState:
        return self._state

    @property
    def current_board_name(self) -> str:
        return self._state.board_name

    # ------------------------------------------------------------------ #
    #  Queries
    # ------------------------------------------------------------------ #

    async def get_status(self) -> dict[str, Any]:
        return {
            "shapes_count": len(self._state.shapes),
            "current_board": self._state.board_name,
        }

    def get_shapes(self) -> list[dict[str, Any]]:
        return [s.model_dump() for s in self._state.shapes]

    # ------------------------------------------------------------------ #
    #  Mutations
    # ------------------------------------------------------------------ #

    async def apply_state(self, update: dict[str, Any]) -> None:
        """Apply a partial state update (usually from the UI)."""
        async with self._lock:
            if "shapes" in update:
                raw_shapes = update.get("shapes") or []
                self._state.shapes = [self._dict_to_shape(sd) for sd in raw_shapes]
            if "dataUrl" in update:
                self._state.dataUrl = update.get("dataUrl") or ""
            self._state.updated_at = time.time()

    async def create_shapes(
        self,
        shapes_data: list[dict[str, Any]],
        source: str = "agent",
    ) -> OperationResult:
        """Add new shapes to the active board."""
        async with self._lock:
            count = 0
            for sd in shapes_data:
                shape = self._dict_to_shape(sd)
                if not shape.id:
                    shape.id = f"{source}_{int(time.time() * 1000)}_{count}"
                self._state.shapes.append(shape)
                count += 1
            self._state.updated_at = time.time()
            return OperationResult(success=True, count=count)

    async def broadcast_event(self, event_name: str, payload: dict[str, Any]) -> None:
        if _get_ws_manager is None:
            return
        try:
            ws_manager = _get_ws_manager()
            await ws_manager.send_data(
                endpoint_name=_WS_NAMESPACE,
                **{_WS_EVENT_KEY: event_name},
                data=payload,
            )
        except Exception as exc:
            logger.debug("Whiteboard broadcast skipped: %s", exc)

    async def clear_canvas(self) -> OperationResult:
        """Remove every shape from the active board."""
        async with self._lock:
            count = len(self._state.shapes)
            self._state.shapes.clear()
            self._state.dataUrl = ""
            self._state.updated_at = time.time()
            return OperationResult(success=True, count=count)

    # ------------------------------------------------------------------ #
    #  Persistence
    # ------------------------------------------------------------------ #

    async def save_board(self, name: str | None = None) -> OperationResult:
        target_name = name or self._state.board_name
        try:
            self._boards_dir.mkdir(parents=True, exist_ok=True)
            filepath = self._boards_dir / f"{target_name}.json"
            payload = {
                "name": target_name,
                "shapes": [s.model_dump() for s in self._state.shapes],
                "updated_at": self._state.updated_at,
                "dataUrl": self._state.dataUrl,
            }
            with open(filepath, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, ensure_ascii=False, indent=2)
            self._state.board_name = target_name
            return OperationResult(success=True, count=len(self._state.shapes))
        except Exception as exc:
            logger.error("Save board failed: %s", exc)
            return OperationResult(success=False, error=str(exc))

    async def load_board(self, name: str) -> OperationResult:
        try:
            filepath = self._boards_dir / f"{name}.json"
            if not filepath.exists():
                # fuzzy match by stem
                for candidate in self._boards_dir.glob("*.json"):
                    if candidate.stem.lower() == name.lower():
                        filepath = candidate
                        break
                else:
                    return OperationResult(success=False, error=f"Board '{name}' not found")

            with open(filepath, "r", encoding="utf-8") as fh:
                data = json.load(fh)

            async with self._lock:
                self._state.board_name = data.get("name", name)
                self._state.shapes = [
                    self._dict_to_shape(sd) for sd in data.get("shapes", [])
                ]
                self._state.dataUrl = data.get("dataUrl", "")
                self._state.updated_at = data.get("updated_at", time.time())
                return OperationResult(success=True, count=len(self._state.shapes))
        except Exception as exc:
            logger.error("Load board failed: %s", exc)
            return OperationResult(success=False, error=str(exc))

    async def list_boards(self) -> list[dict[str, Any]]:
        try:
            if not self._boards_dir.exists():
                return []
            boards: list[dict[str, Any]] = []
            for path in sorted(self._boards_dir.glob("*.json")):
                try:
                    with open(path, "r", encoding="utf-8") as fh:
                        data = json.load(fh)
                    boards.append({
                        "name": data.get("name", path.stem),
                        "shape_count": len(data.get("shapes", [])),
                        "updated_at": data.get("updated_at", 0),
                    })
                except Exception:
                    boards.append({
                        "name": path.stem,
                        "shape_count": 0,
                        "updated_at": 0,
                    })
            return boards
        except Exception as exc:
            logger.error("List boards failed: %s", exc)
            return []

    # ------------------------------------------------------------------ #
    #  Internal helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _dict_to_shape(d: dict[str, Any]) -> Shape:
        source = dict(d) if isinstance(d, dict) else {}
        props_data = dict(source.get("props") or {})
        for key in ("text", "color", "strokeWidth", "fill", "fontSize"):
            if key in source and key not in props_data:
                props_data[key] = source[key]
        allowed_props = {item.name for item in fields(ShapeProps)}
        props = {key: value for key, value in props_data.items() if key in allowed_props}
        return Shape(
            id=source.get("id", ""),
            type=source.get("type", "text"),
            x=float(source.get("x", 0)),
            y=float(source.get("y", 0)),
            w=float(source.get("w", source.get("width", 100))),
            h=float(source.get("h", source.get("height", 60))),
            r=float(source.get("r", 0)),
            points=[float(p) for p in source.get("points", [])],
            props=ShapeProps(**props),
        )


# ------------------------------------------------------------------ #
#  Singleton
# ------------------------------------------------------------------ #
_manager: WhiteboardManager | None = None


def get_shared_manager() -> WhiteboardManager:
    global _manager
    if _manager is None:
        _manager = WhiteboardManager()
    return _manager
