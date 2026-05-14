/**
 * a0_whiteboard — whiteboard-store.js
 * Port of worktree whiteboard-store.js with API paths changed to plugin scope.
 * Board management: POST /api/plugins/a0_whiteboard/<handler>
 * WebSocket: Socket.IO namespace /ws + addHandlers(['plugins/a0_whiteboard/ws_whiteboard'])
 */
import { createStore } from '/js/AlpineStore.js';
import { getNamespacedClient } from '/js/websocket.js';
import { callJsonApi } from '/js/api.js';

const API_BASE = "/plugins/a0_whiteboard";

async function wbPost(handler, body = {}) {
    return callJsonApi(`${API_BASE}/${handler}`, body);
}

export const store = createStore('whiteboard', {
    // State
    isOpen: false,
    isMinimized: false,
    isFullscreen: false,
    privacyMode: false,
    connectionStatus: 'disconnected',
    reconnectAttempts: 0,

    // Position and size
    position: { x: 100, y: 100 },
    size: { width: 600, height: 450 },

    // Drag state
    isDragging: false,
    dragOffset: { x: 0, y: 0 },

    // Resize state
    isResizing: false,
    resizeStart: { x: 0, y: 0, width: 0, height: 0 },

    // WebSocket
    ws: null,
    _wsClient: null,

    init() {
        console.log('[Whiteboard] Initialized.');

        // Restore position/size from sessionStorage (localStorage may be unavailable in iframe context)
        try {
            const savedPosition = sessionStorage.getItem('whiteboard_position');
            if (savedPosition) this.position = JSON.parse(savedPosition);
            const savedSize = sessionStorage.getItem('whiteboard_size');
            if (savedSize) this.size = JSON.parse(savedSize);
        } catch (e) { /* ignore */ }

        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        window.addEventListener('message', this.handleIframeMessage.bind(this));
    },

    handleIframeMessage(event) {
        const message = event.data;
        if (!message?.type) return;

        if (message.type === 'whiteboard:iframe_ready') {
            this.sendToIframe({ type: 'whiteboard:connection_status', status: this.connectionStatus });
        } else if (message.type === 'whiteboard:request_sync') {
            if (this._wsClient) {
                this._wsClient.emit('whiteboard_request_state', {}).catch(() => {});
            }
        } else if (message.type === 'whiteboard:state_change' || message.type === 'whiteboard:full_state') {
            if (!this.privacyMode && this._wsClient) {
                const { type, ...rest } = message;
                this._wsClient.emit('whiteboard_state_change', rest).catch(() => {});
            }
        }
    },

    _unwrapWsPayload(envelope) {
        const payload = envelope?.data ?? envelope ?? {};
        if (payload?.data && !payload.action && !payload.state && !payload.dataUrl && !payload.shapes) {
            return payload.data;
        }
        return payload;
    },

    togglePrivacyMode() {
        this.privacyMode = !this.privacyMode;
    },

    sendToIframe(message) {
        const iframe = document.querySelector('.whiteboard-iframe');
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(message, '*');
        }
    },

    open() {
        this.isOpen = true;
        this.isMinimized = false;
        if (!this._wsClient) this.connectWebSocket();
    },

    close() {
        this.isOpen = false;
        if (this._wsClient) {
            this._wsClient.disconnect();
            this._wsClient = null;
        }
    },

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
    },

    showAgentNotification(action, data) {
        let message = '🎨 Agent updated whiteboard';
        if (action === 'create_shapes') message = `🎨 Agent created ${data?.shapes?.length || 0} shape(s)`;
        else if (action === 'update_shape') message = '🎨 Agent updated a shape';
        else if (action === 'delete_shape') message = '🎨 Agent deleted a shape';
        else if (action === 'clear_canvas') message = '🎨 Agent cleared the whiteboard';

        if (!this.isOpen) {
            const btn = document.getElementById('whiteboard');
            if (btn) {
                btn.classList.add('whiteboard-notification');
                setTimeout(() => btn.classList.remove('whiteboard-notification'), 3000);
            }
        }
        this.showToast(message);
    },

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'whiteboard-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            background: #1a1a2e; color: #fff; padding: 12px 20px;
            border-radius: 8px; border: 1px solid #3b82f6;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
        if (this.isFullscreen) {
            this.savedPosition = { ...this.position };
            this.savedSize = { ...this.size };
            this.position = { x: 0, y: 0 };
            this.size = { width: window.innerWidth, height: window.innerHeight };
        } else {
            this.position = this.savedPosition || { x: 100, y: 100 };
            this.size = this.savedSize || { width: 600, height: 450 };
        }
    },

    getPanelStyle() {
        if (this.isFullscreen) return 'top: 0; left: 0; width: 100vw; height: 100vh; border-radius: 0;';
        return `top: ${this.position.y}px; left: ${this.position.x}px; width: ${this.size.width}px; height: ${this.size.height}px;`;
    },

    startDrag(event) {
        if (this.isFullscreen) return;
        this.isDragging = true;
        this.dragOffset = { x: event.clientX - this.position.x, y: event.clientY - this.position.y };
        event.preventDefault();
    },

    startResize(event) {
        if (this.isFullscreen) return;
        this.isResizing = true;
        this.resizeStart = { x: event.clientX, y: event.clientY, width: this.size.width, height: this.size.height };
        event.preventDefault();
    },

    handleMouseMove(event) {
        if (this.isDragging) {
            this.position = {
                x: Math.max(0, event.clientX - this.dragOffset.x),
                y: Math.max(0, event.clientY - this.dragOffset.y),
            };
        }
        if (this.isResizing) {
            const dx = event.clientX - this.resizeStart.x;
            const dy = event.clientY - this.resizeStart.y;
            this.size = {
                width: Math.max(300, this.resizeStart.width + dx),
                height: Math.max(250, this.resizeStart.height + dy),
            };
        }
    },

    handleMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            try { sessionStorage.setItem('whiteboard_position', JSON.stringify(this.position)); } catch (e) {}
        }
        if (this.isResizing) {
            this.isResizing = false;
            try { sessionStorage.setItem('whiteboard_size', JSON.stringify(this.size)); } catch (e) {}
        }
    },

    connectWebSocket() {
        if (!this.isOpen) return;
        try {
            this.connectionStatus = 'connecting';
            this._wsClient = getNamespacedClient('/ws');
            this._wsClient.addHandlers(['plugins/a0_whiteboard/ws_whiteboard']);

            this._wsClient.onConnect(() => {
                this.connectionStatus = 'connected';
                this.sendToIframe({ type: 'whiteboard:connection_status', status: 'connected' });
                this._wsClient.emit('whiteboard_request_state', {}).catch(() => {});
            });

            this._wsClient.onDisconnect(() => {
                this.connectionStatus = 'disconnected';
                this.sendToIframe({ type: 'whiteboard:connection_status', status: 'disconnected' });
            });

            this._wsClient.onError((error) => {
                this.connectionStatus = 'disconnected';
                console.error('[Whiteboard] WebSocket error:', error);
            });

            this._wsClient.on('whiteboard_initial_state', (envelope) => {
                const payload = this._unwrapWsPayload(envelope);
                const state = payload.state || payload;
                if (state) this.sendToIframe({ type: 'whiteboard:initial_state', state });
            });

            this._wsClient.on('whiteboard_intent', (envelope) => {
                const payload = this._unwrapWsPayload(envelope);
                const { action, data } = payload || {};
                this.sendToIframe({ type: 'whiteboard:intent', action, data, metadata: payload?.metadata });
                if (payload?.metadata?.source === 'agent') {
                    this.showAgentNotification(action, data);
                }
            });

            this._wsClient.on('whiteboard_state_change', (envelope) => {
                const payload = this._unwrapWsPayload(envelope);
                this.sendToIframe({ type: 'whiteboard:state_change', ...payload });
            });

            this._wsClient.connect().catch((error) => {
                this.connectionStatus = 'disconnected';
                console.error('[Whiteboard] Failed to connect:', error);
            });
        } catch (error) {
            this.connectionStatus = 'disconnected';
            console.error('[Whiteboard] Failed to create client:', error);
        }
    },

    // Board Management — all paths now plugin-scoped
    async saveBoard() {
        const name = prompt('Enter board name (optional):');
        if (name === null) return;
        try {
            const result = await wbPost('whiteboard_save', { data: { name: name || undefined } });
            this.showToast(result.success ? `💾 Saved: ${result.name}` : `❌ Failed: ${result.error}`);
        } catch (e) {
            this.showToast('❌ Save failed');
        }
    },

    async showLoadDialog() {
        try {
            const result = await wbPost('whiteboard_list', {});
            if (!result.success || !result.boards.length) {
                this.showToast('📂 No saved boards found');
                return;
            }
            const boardList = result.boards.map((b, i) => `${i + 1}. ${b.name} (${b.shape_count} shapes)`).join('\n');
            const selection = prompt(`Select board to load:\n\n${boardList}\n\nEnter name or number:`);
            if (selection) await this.loadBoard(selection.trim());
        } catch (e) {
            this.showToast('❌ Failed to list boards');
        }
    },

    async loadBoard(name) {
        try {
            const result = await wbPost('whiteboard_load', { data: { name } });
            if (result.success) {
                this.showToast(`📂 Loaded: ${result.name}`);
                if (this._wsClient) this._wsClient.emit('whiteboard_request_state', {}).catch(() => {});
            } else {
                this.showToast(`❌ Failed: ${result.error}`);
            }
        } catch (e) {
            this.showToast('❌ Load failed');
        }
    },

    async clearBoard() {
        if (!confirm('Clear all shapes from the board?')) return;
        try {
            const result = await wbPost('whiteboard_clear', {});
            if (result.success) {
                this.showToast(`🗑️ Cleared: ${result.count} shapes removed`);
                this.sendToIframe({ type: 'whiteboard:intent', action: 'clear_canvas' });
            } else {
                this.showToast(`❌ Failed: ${result.error}`);
            }
        } catch (e) {
            this.showToast('❌ Clear failed');
        }
    },
});
