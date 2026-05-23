/**
 * a0_whiteboard — whiteboard-store.js
 *
 * Right Canvas surface store (A0 v1.15). Lives inside the docked surface,
 * so all floating-panel chrome (drag, resize, minimize, fullscreen) is
 * owned by the canvas system and intentionally absent here.
 *
 * Responsibilities:
 *   - WebSocket sync with /plugins/a0_whiteboard/ws_whiteboard
 *   - postMessage bridge to whichever engine iframe is mounted
 *     (tldraw-engine.html or canvas.html)
 *   - Engine + surface-mode state, persisted across reloads
 *   - Board persistence (save/load/list/clear) via plugin REST API
 *
 * Protocol with engine iframes is unchanged:
 *   whiteboard:iframe_ready, whiteboard:initial_state, whiteboard:state_change,
 *   whiteboard:full_state, whiteboard:intent, whiteboard:request_sync,
 *   whiteboard:connection_status
 */
import { createStore } from '/js/AlpineStore.js';
import { getNamespacedClient } from '/js/websocket.js';
import { callJsonApi } from '/js/api.js';

const API_BASE = "/plugins/a0_whiteboard";
const ENGINE_TLDRAW = '/plugins/a0_whiteboard/webui/engines/tldraw-engine.html';
const ENGINE_HTML5 = '/plugins/a0_whiteboard/webui/canvas.html';
const LS_ENGINE = 'whiteboard_engine';

async function wbPost(handler, body = {}) {
    return callJsonApi(`${API_BASE}/${handler}`, body);
}

export const store = createStore('whiteboard', {
    privacyMode: false,
    connectionStatus: 'disconnected',
    reconnectAttempts: 0,

    currentEngine: 'tldraw',
    surfaceMode: 'canvas',
    pendingAttention: false,

    ws: null,
    _wsClient: null,
    _mounted: false,
    _applyingRemote: false,

    init() {
        try {
            const saved = localStorage.getItem(LS_ENGINE);
            if (saved === 'tldraw' || saved === 'html5') this.currentEngine = saved;
        } catch (e) { /* ignore */ }
        window.addEventListener('message', this.handleIframeMessage.bind(this));
    },

    get engineUrl() {
        return this.currentEngine === 'html5' ? ENGINE_HTML5 : ENGINE_TLDRAW;
    },

    onPanelMount(el) {
        this._mounted = true;
        if (!this._wsClient) this.connectWebSocket();
        try { this.pendingAttention = false; } catch (e) {}
    },

    onSurfaceModeChange(mode) {
        if (mode === 'canvas' || mode === 'modal') this.surfaceMode = mode;
    },

    toggleMode() {
        const next = this.surfaceMode === 'modal' ? 'canvas' : 'modal';
        try {
            if (window.A0RightCanvas && typeof window.A0RightCanvas.setMode === 'function') {
                window.A0RightCanvas.setMode('whiteboard', next);
                this.surfaceMode = next;
                return;
            }
        } catch (e) { /* fall through */ }
        // Fallback: dispatch a custom event the canvas system may listen for.
        // Verify against A0 v1.15 source and replace this branch with the
        // documented API call once it is confirmed.
        window.dispatchEvent(new CustomEvent('a0:right-canvas:set-mode', {
            detail: { surfaceId: 'whiteboard', mode: next },
        }));
        this.surfaceMode = next;
    },

    switchEngine(engine) {
        if (engine !== 'tldraw' && engine !== 'html5') return;
        if (engine === this.currentEngine) return;
        this.currentEngine = engine;
        try { localStorage.setItem(LS_ENGINE, engine); } catch (e) {}
        // The iframe's :src binding re-renders. After the new engine signals
        // iframe_ready we request a fresh state so it rehydrates from server.
    },

    handleIframeMessage(event) {
        const message = event.data;
        if (!message?.type) return;

        if (message.type === 'whiteboard:iframe_ready') {
            this.sendToIframe({ type: 'whiteboard:connection_status', status: this.connectionStatus });
            if (this._wsClient) {
                this._wsClient.emit('whiteboard_request_state', {}).catch(() => {});
            }
        } else if (message.type === 'whiteboard:request_sync') {
            if (this._wsClient) {
                this._wsClient.emit('whiteboard_request_state', {}).catch(() => {});
            }
        } else if (message.type === 'whiteboard:state_change' || message.type === 'whiteboard:full_state') {
            if (this._applyingRemote) return;
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

    requestFocus() {
        // Ask the canvas system to focus/dock the whiteboard surface.
        // Verify the exact API against A0 v1.15 source.
        try {
            if (window.A0RightCanvas && typeof window.A0RightCanvas.focus === 'function') {
                window.A0RightCanvas.focus('whiteboard');
                return;
            }
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('a0:right-canvas:focus', {
            detail: { surfaceId: 'whiteboard' },
        }));
        this.pendingAttention = true;
    },

    showAgentNotification(action, data) {
        let message = '🎨 Agent updated whiteboard';
        if (action === 'create_shapes') message = `🎨 Agent created ${data?.shapes?.length || 0} shape(s)`;
        else if (action === 'update_shape') message = '🎨 Agent updated a shape';
        else if (action === 'delete_shape') message = '🎨 Agent deleted a shape';
        else if (action === 'clear_canvas') message = '🎨 Agent cleared the whiteboard';

        this.requestFocus();
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
        setTimeout(() => { setTimeout(() => toast.remove(), 300); }, 3000);
    },

    connectWebSocket() {
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
                if (state) {
                    this._applyingRemote = true;
                    this.sendToIframe({ type: 'whiteboard:initial_state', state });
                    setTimeout(() => { this._applyingRemote = false; }, 400);
                }
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
                this._applyingRemote = true;
                this.sendToIframe({ type: 'whiteboard:state_change', ...payload });
                setTimeout(() => { this._applyingRemote = false; }, 400);
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
