# TODO: evaluate in v1.7
"""
Whiteboard Initialization Extension

This extension runs during agent_init to set up the whiteboard tool.
It initializes the WhiteboardManager and optionally connects the AG-UI bridge.

Naming convention: _30_ means it runs after settings are loaded (15-20)
but leaves room for other extensions.

The actual WhiteboardTool is lazy-initialized on first use, but this
extension ensures logging and status are available.
"""

import logging
from typing import TYPE_CHECKING

try:
    from helpers.extension import Extension
except ImportError:
    from python.helpers.extension import Extension  # type: ignore

if TYPE_CHECKING:
    from agent import Agent

logger = logging.getLogger(__name__)

# Global flag to ensure bridge connects only once
_bridge_connected = False


class WhiteboardInit(Extension):
    """
    Initialize whiteboard extension on agent startup.
    
    This extension:
    1. Checks if whiteboard is enabled (via settings or env)
    2. Logs availability status
    3. Optionally pre-connects the AG-UI bridge
    
    The actual tool (python/tools/whiteboard.py) handles its own
    lazy initialization, so this is mainly for status logging
    and optional eager initialization.
    """
    
    def execute(self, **kwargs) -> None:
        """Execute the extension during agent initialization."""
        if not self.agent:
            return
        
        try:
            # Check if whiteboard should be enabled
            # Can be disabled via settings.json or environment variable
            whiteboard_enabled = self._is_whiteboard_enabled()
            
            if not whiteboard_enabled:
                logger.debug("Whiteboard extension disabled via settings")
                return
            
            # Log that whiteboard is available
            self.agent.context.log.log(
                type="info",
                heading="Whiteboard Extension",
                content="Whiteboard tool available. Use 'whiteboard' tool to create visual diagrams.",
            )
            
            logger.info(f"Whiteboard extension initialized for agent {self.agent.number}")
            
            # Optionally try to connect AG-UI bridge eagerly (non-blocking deferred)
            if self._should_eager_connect():
                try:
                    from helpers import defer
                    defer.DeferredTask("WhiteboardEagerConnect").start_task(self._try_connect_bridge)
                except Exception:
                    pass
                
        except ImportError as e:
            logger.debug(f"Whiteboard extension not fully installed: {e}")
        except Exception as e:
            logger.warning(f"Whiteboard initialization warning: {e}")
    
    def _is_whiteboard_enabled(self) -> bool:
        """
        Check if whiteboard is enabled.
        
        Checks in order:
        1. Agent config additional settings
        2. Environment variable WHITEBOARD_ENABLED
        3. Default: True (enabled by default)
        """
        import os
        
        # Check agent config
        if hasattr(self.agent.config, 'additional') and isinstance(self.agent.config.additional, dict):
            if 'whiteboard_enabled' in self.agent.config.additional:
                return bool(self.agent.config.additional['whiteboard_enabled'])
        
        # Check environment variable
        env_value = os.environ.get('WHITEBOARD_ENABLED', 'true').lower()
        return env_value in ('true', '1', 'yes', 'on')
    
    def _should_eager_connect(self) -> bool:
        """
        Check if we should try to connect AG-UI bridge eagerly.
        
        By default, we eagerly connect to enable bidirectional sync.
        Can be disabled via WHITEBOARD_EAGER_CONNECT=false
        """
        import os
        env_value = os.environ.get('WHITEBOARD_EAGER_CONNECT', 'false').lower()
        return env_value in ('true', '1', 'yes', 'on')
    
    async def _try_connect_bridge(self) -> None:
        """Eagerly initialize the whiteboard manager (replaces legacy AG-UI bridge)."""
        global _bridge_connected

        if _bridge_connected:
            return

        try:
            try:
                from usr.plugins.a0_whiteboard.helpers.whiteboard import get_shared_manager
            except ImportError:
                from helpers.whiteboard import get_shared_manager  # type: ignore

            manager = get_shared_manager()
            _bridge_connected = True
            logger.info("Whiteboard manager eagerly initialized")
            print("[Whiteboard] Manager initialized eagerly")
        except Exception as e:
            logger.debug(f"Whiteboard eager init skipped: {e}")
            print(f"[Whiteboard] Eager init failed: {e}")
