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

let _sharedWsClient = null;
let _wsHandlersRegistered = false;
let _boundIframeHandler = null;
let _iframeListenerReady = false;
const STATE_REQUEST_MIN_MS = 300;

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
    _lastStateRequestAt: 0,
    _boardRevision: 0,
    _boardShapeCount: -1,
    _boardFingerprint: '',
    _reconcileTimer: null,

    requestStateFromServer() {
        const now = Date.now();
        if (now - (this._lastStateRequestAt || 0) < STATE_REQUEST_MIN_MS) return;
        this._lastStateRequestAt = now;
        if (this._wsClient && this.connectionStatus === 'connected') {
            this._wsClient.emit('whiteboard_request_state', {}).catch(() => {});
        }
    },

    init() {
        if (this._initDone) return;
        this._initDone = true;
        try {
            const saved = localStorage.getItem(LS_ENGINE);
            if (saved === 'tldraw' || saved === 'html5') this.currentEngine = saved;
        } catch (e) { /* ignore */ }
        if (!_iframeListenerReady) {
            _iframeListenerReady = true;
            _boundIframeHandler = (event) => this.handleIframeMessage(event);
            window.addEventListener('message', _boundIframeHandler);
        }
    },

    get engineUrl() {
        return this.currentEngine === 'html5' ? ENGINE_HTML5 : ENGINE_TLDRAW;
    },

    onPanelMount(el) {
        this._mounted = true;
        this.connectWebSocket();
        try { this.pendingAttention = false; } catch (e) {}
    },

    // Right Canvas surface lifecycle — called by register-whiteboard.js when the
    // surface is mounted into the canvas (canvas or modal mode).
    async onOpen(el, opts = {}) {
        this.init();
        this._panelRoot = el || this._panelRoot || null;
        if (opts && (opts.mode === 'canvas' || opts.mode === 'modal')) {
            this.surfaceMode = opts.mode;
        }
        this.onPanelMount(el);
    },

    // Right Canvas surface lifecycle — called when the surface is closed.
    // Keep the WebSocket alive so re-opening is instant; just clear UI hints.
    cleanup() {
        try { this.pendingAttention = false; } catch (e) {}
    },

    // Dock handoff hooks — no-ops for the whiteboard (no thumbnail/freeze
    // needed because the iframe persists across mode changes via the canvas
    // chrome). Kept as stubs so the canvas system can call them safely.
    beginSurfaceHandoff() { /* no-op */ },
    finishSurfaceHandoff() { /* no-op */ },
    cancelSurfaceHandoff() { /* no-op */ },

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
            this.requestStateFromServer();
        } else if (message.type === 'whiteboard:request_sync') {
            this.requestStateFromServer();
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

    _boardFingerprintFrom(shapes) {
        if (!Array.isArray(shapes)) return '';
        return shapes
            .map((s) => `${s?.id || ''}|${s?.type || ''}|${Math.round(Number(s?.x) || 0)}|${Math.round(Number(s?.y) || 0)}`)
            .sort()
            .join('\n');
    },

    _extractSnapshot(payload) {
        if (!payload || typeof payload !== 'object') return null;
        const state = payload.state && typeof payload.state === 'object' ? payload.state : payload;
        const shapes = Array.isArray(state?.shapes)
            ? state.shapes
            : (Array.isArray(payload.shapes) ? payload.shapes : []);
        const revision = Number(state?.updated_at ?? payload?.revision ?? 0);
        const stateOut = {
            ...state,
            shapes,
            updated_at: revision || state?.updated_at || Date.now() / 1000,
        };
        return {
            state: stateOut,
            shapes,
            revision: revision || stateOut.updated_at,
            count: shapes.length,
            fingerprint: this._boardFingerprintFrom(shapes),
        };
    },

    scheduleBoardReconcile(opts = {}) {
        const delay = opts.immediate ? 0 : 120;
        if (this._reconcileTimer) clearTimeout(this._reconcileTimer);
        this._reconcileTimer = setTimeout(() => {
            this._reconcileTimer = null;
            this.requestStateFromServer();
        }, delay);
    },

    reconcileFromServer(payload, meta = {}) {
        const snap = payload ? this._extractSnapshot(payload) : null;
        if (!snap) {
            this.scheduleBoardReconcile({ immediate: true });
            return false;
        }

        const changed = snap.revision !== this._boardRevision
            || snap.count !== this._boardShapeCount
            || snap.fingerprint !== this._boardFingerprint;

        if (!changed) return false;

        const prevCount = this._boardShapeCount;
        this._boardRevision = snap.revision;
        this._boardShapeCount = snap.count;
        this._boardFingerprint = snap.fingerprint;

        this._applyingRemote = true;
        this.sendToIframe({ type: 'whiteboard:initial_state', state: snap.state });
        setTimeout(() => { this._applyingRemote = false; }, 400);

        if (prevCount >= 0 && snap.count !== prevCount && meta.source !== 'initial') {
            const delta = snap.count - prevCount;
            const label = delta > 0 ? `+${delta}` : `${delta}`;
            this.showToast(`🔄 לוח מסונכרן (${label}, ${snap.count} סה"כ)`);
        }
        return true;
    },

    togglePrivacyMode() {
        this.privacyMode = !this.privacyMode;
    },

    sendToIframe(message) {
        const scoped = this._panelRoot?.querySelector?.('.whiteboard-iframe');
        const global = document.querySelector('.whiteboard-iframe');
        const visible = Array.from(document.querySelectorAll('.whiteboard-iframe'))
            .find((node) => node.offsetParent !== null);
        const iframe = scoped || visible || global;
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(message, '*');
        }
    },

    requestFocus() {
        // Agent Zero v1.16+ made canvas auto-open opt-in ("Tool results no
        // longer auto-open the Browser or Office canvas; explicit user
        // actions are required"). We respect that by default: we flip a
        // pendingAttention flag so the panel header pulses, and only call
        // the focus API if the user already has the panel mounted (i.e.
        // they previously opted in to the surface).
        this.pendingAttention = true;
        if (!this._mounted) return;
        try {
            if (window.A0RightCanvas && typeof window.A0RightCanvas.focus === 'function') {
                window.A0RightCanvas.focus('whiteboard');
                return;
            }
        } catch (e) {}
        // Custom-event fallback for builds that don't expose a global API.
        window.dispatchEvent(new CustomEvent('a0:right-canvas:focus', {
            detail: { surfaceId: 'whiteboard' },
        }));
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

    _reconnectTimer: null,
    scheduleReconnect() {
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`[Whiteboard] Scheduling reconnect attempt #${this.reconnectAttempts} in ${delay}ms`);
        this._reconnectTimer = setTimeout(() => {
            if (this.connectionStatus === 'connected') return;
            this.showToast(`🔄 Reconnecting to agent (attempt #${this.reconnectAttempts})...`);
            if (this._wsClient) {
                this.connectionStatus = 'connecting';
                this._wsClient.connect().catch((error) => {
                    this.connectionStatus = 'disconnected';
                    console.error('[Whiteboard] Reconnect failed:', error);
                    this.scheduleReconnect();
                });
            } else {
                this.connectWebSocket();
            }
        }, delay);
    },

    connectWebSocket() {
        try {
            this.connectionStatus = 'connecting';
            if (!_sharedWsClient) {
                _sharedWsClient = getNamespacedClient('/ws');
                _sharedWsClient.addHandlers(['plugins/a0_whiteboard/ws_whiteboard']);
            }
            this._wsClient = _sharedWsClient;

            if (!_wsHandlersRegistered) {
                _wsHandlersRegistered = true;

                this._wsClient.onConnect(() => {
                    store.connectionStatus = 'connected';
                    store.reconnectAttempts = 0;
                    if (store._reconnectTimer) clearTimeout(store._reconnectTimer);
                    store.sendToIframe({ type: 'whiteboard:connection_status', status: 'connected' });
                    store.requestStateFromServer();
                    store.showToast('🟢 Connected to agent');
                });

                this._wsClient.onDisconnect(() => {
                    if (store.connectionStatus === 'connected') {
                        store.showToast('🔴 Disconnected from agent');
                    }
                    store.connectionStatus = 'disconnected';
                    store.sendToIframe({ type: 'whiteboard:connection_status', status: 'disconnected' });
                    store.scheduleReconnect();
                });

                this._wsClient.onError((error) => {
                    const msg = String(error?.message || error || '');
                    // Shared /ws client: other plugins (e.g. swarm on "connect") can trigger envelope validation errors.
                    if (msg.includes('envelope must be a plain object') || msg.includes('Server envelope')) {
                        return;
                    }
                    store.connectionStatus = 'disconnected';
                    console.error('[Whiteboard] WebSocket error:', error);
                    store.scheduleReconnect();
                });

                this._wsClient.on('whiteboard_initial_state', (envelope) => {
                    const payload = store._unwrapWsPayload(envelope);
                    store.reconcileFromServer(payload, { source: 'initial' });
                });

                this._wsClient.on('whiteboard_intent', (envelope) => {
                    const payload = store._unwrapWsPayload(envelope);
                    const { action, data } = payload || {};
                    if (payload?.metadata?.source === 'agent') {
                        store.showAgentNotification(action, data);
                    }
                    // Authoritative sync: pull full server snapshot instead of incremental iframe intents.
                    store.scheduleBoardReconcile({ immediate: true });
                });

                this._wsClient.on('whiteboard_state_change', (envelope) => {
                    const payload = store._unwrapWsPayload(envelope);
                    store.reconcileFromServer(payload, { source: 'state_change' });
                });
            }

            if (this._wsClient.isConnected?.()) {
                this.connectionStatus = 'connected';
                return;
            }

            this._wsClient.connect().catch((error) => {
                this.connectionStatus = 'disconnected';
                console.error('[Whiteboard] Failed to connect:', error);
                this.scheduleReconnect();
            });
        } catch (error) {
            this.connectionStatus = 'disconnected';
            console.error('[Whiteboard] Failed to create client:', error);
            this.scheduleReconnect();
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
            if (!selection) return;
            const trimmed = selection.trim();
            const idx = parseInt(trimmed, 10);
            const name = (!Number.isNaN(idx) && idx >= 1 && idx <= result.boards.length)
                ? result.boards[idx - 1].name
                : trimmed;
            await this.loadBoard(name);
        } catch (e) {
            this.showToast('❌ Failed to list boards');
        }
    },

    async loadBoard(name) {
        try {
            const result = await wbPost('whiteboard_load', { data: { name } });
            if (result.success) {
                this.showToast(`📂 Loaded: ${result.name} (${result.count} shapes)`);
                if (result.state) {
                    this.reconcileFromServer({ state: result.state }, { source: 'load' });
                } else if (this._wsClient) {
                    this.requestStateFromServer();
                }
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
                if (this._wsClient) {
                    this._wsClient.emit('whiteboard_state_change', { shapes: [] }).catch(() => {});
                }
                this.sendToIframe({ type: 'whiteboard:intent', action: 'clear_canvas' });
            } else {
                this.showToast(`❌ Failed: ${result.error}`);
            }
        } catch (e) {
            this.showToast('❌ Clear failed');
        }
    },
});
