import { useState, useCallback, useEffect, useRef } from 'react'
import { Tldraw, createShapeId, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import './App.css'

// Map hex colors to tldraw color names
function hexToTldrawColor(hex: string | undefined): string {
    if (!hex) return 'blue'
    const colorMap: Record<string, string> = {
        '#3b82f6': 'blue',
        '#10b981': 'green',
        '#ef4444': 'red',
        '#f59e0b': 'orange',
        '#8b5cf6': 'violet',
        '#000000': 'black',
        '#ffffff': 'white',
        '#6b7280': 'grey',
        '#eab308': 'yellow',
    }
    return colorMap[hex.toLowerCase()] || 'blue'
}

// Convert agent shape format to tldraw format
function convertToTldrawShape(agentShape: any): any {
    const shapeId = createShapeId(agentShape.id || `shape_${Date.now()}`)

    // Map agent shape types to tldraw types
    const typeMap: Record<string, string> = {
        'rectangle': 'geo',
        'circle': 'geo',
        'ellipse': 'geo',
        'text': 'text',
        'arrow': 'arrow',
        'line': 'line',
    }

    const tldrawType = typeMap[agentShape.type] || 'geo'

    // Build tldraw shape
    const shape: any = {
        id: shapeId,
        type: tldrawType,
        x: agentShape.x || 100,
        y: agentShape.y || 100,
        props: {}
    }

    // Set props based on type
    if (tldrawType === 'geo') {
        shape.props = {
            geo: agentShape.type === 'circle' || agentShape.type === 'ellipse' ? 'ellipse' : 'rectangle',
            w: agentShape.width || 100,
            h: agentShape.height || 60,
            color: hexToTldrawColor(agentShape.props?.fill),
            fill: 'solid',
            dash: 'solid',
            size: 'm',
        }
    } else if (tldrawType === 'text') {
        shape.props = {
            text: agentShape.props?.text || 'Text',
            color: 'black',
            size: 'm',
        }
    }

    console.log('[Whiteboard UI] Converted shape:', agentShape, '->', shape)
    return shape
}

function App() {
    const [editor, setEditor] = useState<Editor | null>(null)
    const [status, setStatus] = useState('connecting')
    // Queue messages that arrive before editor is ready
    const pendingMessages = useRef<any[]>([])

    // Process a single message
    const processMessage = useCallback((message: any, currentEditor: Editor) => {
        console.log('[Whiteboard UI] Processing message:', message.type)

        // Handle initial state from server (sync agent's shapes to UI)
        if (message.type === 'whiteboard:initial_state') {
            const state = message.state
            if (state?.shapes && state.shapes.length > 0) {
                console.log('[Whiteboard UI] Loading initial state:', state.shapes.length, 'shapes')
                try {
                    // Clear existing shapes first
                    const existingShapes = currentEditor.getCurrentPageShapes()
                    if (existingShapes.length > 0) {
                        currentEditor.deleteShapes(existingShapes.map(s => s.id))
                    }
                    // Convert and create agent shapes
                    const tldrawShapes = state.shapes.map(convertToTldrawShape)
                    currentEditor.createShapes(tldrawShapes)
                    console.log('[Whiteboard UI] Loaded', tldrawShapes.length, 'shapes from server')
                } catch (err) {
                    console.error('[Whiteboard UI] Error loading initial state:', err)
                }
            } else {
                console.log('[Whiteboard UI] Initial state is empty')
            }
            return
        }

        if (message.type === 'whiteboard:intent') {
            const { action, data } = message
            console.log('[Whiteboard UI] Processing intent:', action, data)

            try {
                if (action === 'create_shapes' && data?.shapes) {
                    // Convert agent shapes to tldraw format
                    const tldrawShapes = data.shapes.map(convertToTldrawShape)
                    console.log('[Whiteboard UI] Creating shapes:', tldrawShapes)
                    currentEditor.createShapes(tldrawShapes)
                } else if (action === 'update_shape') {
                    currentEditor.updateShape({ id: createShapeId(data.shape_id), ...data.props })
                } else if (action === 'delete_shape') {
                    currentEditor.deleteShape(createShapeId(data.shape_id))
                } else if (action === 'clear_canvas') {
                    currentEditor.selectAll().deleteShapes(currentEditor.getSelectedShapeIds())
                } else if (action === 'sync_state') {
                    // Send all shapes to parent
                    const allShapes = currentEditor.getCurrentPageShapes()
                    window.parent.postMessage({
                        type: 'whiteboard:full_state',
                        shapes: Array.from(allShapes),
                        metadata: { source: 'ui', timestamp: Date.now() }
                    }, '*')
                    console.log('[Whiteboard UI] Sent full state sync:', allShapes.length, 'shapes')
                }
            } catch (err) {
                console.error('[Whiteboard UI] Error processing intent:', err)
            }
        }
    }, [])

    // Handle messages from parent window (whiteboard-store.js)
    const handleParentMessage = useCallback((event: MessageEvent) => {
        // Only accept messages from parent
        if (event.source !== window.parent) return

        const message = event.data
        if (!message?.type) return

        console.log('[Whiteboard UI] Received message:', message.type)

        // Handle connection status even without editor
        if (message.type === 'whiteboard:connection_status') {
            setStatus(message.status)
            return
        }

        // If editor not ready, queue the message
        if (!editor) {
            console.log('[Whiteboard UI] Editor not ready, queuing message:', message.type)
            pendingMessages.current.push(message)
            return
        }

        // Process immediately
        processMessage(message, editor)
    }, [editor, processMessage])

    // Socket.io for standalone mode
    const standaloneSocket = useRef<any>(null)

    const sendToParent = useCallback((message: any) => {
        if (window.self === window.top && standaloneSocket.current) {
            // Standalone mode - send via socket directly
            if (message.type === 'whiteboard:state_change' || message.type === 'whiteboard:full_state') {
                const { type, ...rest } = message;
                standaloneSocket.current.emit('whiteboard_state_change', rest);
            } else if (message.type === 'whiteboard:request_sync') {
                standaloneSocket.current.emit('whiteboard_request_state', {});
            }
        } else {
            // Embedded mode - send to parent
            window.parent.postMessage(message, '*')
        }
    }, [])

    // Setup standalone socket if not in iframe
    useEffect(() => {
        if (window.self !== window.top) return;

        console.log('[Whiteboard UI] Standalone mode detected! Connecting directly to Socket.IO...');

        // Dynamically import socket.io-client
        import('socket.io-client').then(({ io }) => {
            // Connect to Agent Zero main API on 50080 or dynamic port
            const url = window.location.port === '5173' || window.location.port === '4173'
                ? `http://${window.location.hostname}:50080/whiteboard`
                : '/whiteboard';

            const socket = io(url, { path: '/socket.io' });
            standaloneSocket.current = socket;

            socket.on('connect', () => {
                setStatus('connected');
                // Request initial state on connect
                socket.emit('whiteboard_request_state', {});
            });

            socket.on('connect_error', (error: any) => {
                console.error('[Whiteboard UI] Standalone Socket connect_error:', error);
                setStatus('disconnected');
            });

            socket.on('disconnect', () => setStatus('disconnected'));

            socket.on('whiteboard_initial_state', (envelope: any) => {
                window.postMessage({
                    type: 'whiteboard:initial_state',
                    state: envelope.data?.state || envelope.state
                }, '*');
            });

            socket.on('whiteboard_intent', (envelope: any) => {
                const { action, data } = envelope.data || envelope;
                window.postMessage({
                    type: 'whiteboard:intent',
                    action, data
                }, '*');
            });

            socket.on('whiteboard_state_change', (envelope: any) => {
                window.postMessage({
                    type: 'whiteboard:state_change',
                    ...((envelope.data || envelope) as object)
                }, '*');
            });
        });

        return () => {
            if (standaloneSocket.current) {
                standaloneSocket.current.disconnect();
            }
        };
    }, []);

    // Listen for messages from parent window or self
    useEffect(() => {
        window.addEventListener('message', handleParentMessage)

        if (window.self !== window.top) {
            // Notify parent that iframe is ready (only in embedded mode)
            window.parent.postMessage({ type: 'whiteboard:iframe_ready' }, '*')
        }

        return () => window.removeEventListener('message', handleParentMessage)
    }, [handleParentMessage])

    // When editor becomes available, process pending messages AND request sync
    useEffect(() => {
        if (!editor) return

        console.log('[Whiteboard UI] Editor ready, processing', pendingMessages.current.length, 'pending messages')

        // Process any queued messages
        while (pendingMessages.current.length > 0) {
            const msg = pendingMessages.current.shift()
            processMessage(msg, editor)
        }

        // Request fresh state from server via parent (or self in standalone)
        console.log('[Whiteboard UI] Requesting fresh state from server...')
        sendToParent({
            type: 'whiteboard:request_sync',
            metadata: { source: 'ui', timestamp: Date.now() }
        })

    }, [editor, processMessage, sendToParent])

    // Sync editor changes back to parent (which forwards to WebSocket)
    useEffect(() => {
        if (!editor) return

        const unlisten = editor.sideEffects.registerAfterChangeHandler('shape', (prev, next, source) => {
            if (source !== 'user') return

            if (!next && prev) {
                // Deletion
                sendToParent({
                    type: 'whiteboard:state_change',
                    action: 'delete',
                    shape_id: prev.id.replace('shape:', ''),
                    metadata: { source: 'ui', timestamp: Date.now() }
                })
                console.log('[Whiteboard UI] Shape deleted:', prev.id)
            } else if (next) {
                // Creation or Update
                sendToParent({
                    type: 'whiteboard:state_change',
                    action: 'update',
                    shape: next,
                    metadata: { source: 'ui', timestamp: Date.now() }
                })
            }
        })

        return unlisten
    }, [editor, sendToParent])

    return (
        <div className="tldraw-container" style={{ position: 'fixed', inset: 0 }}>
            <Tldraw onMount={setEditor} />
            <div className="status-indicator" style={{
                position: 'absolute', bottom: 10, right: 10,
                padding: '4px 8px', borderRadius: 4, background: '#333', color: '#fff', fontSize: 12, zIndex: 1000
            }}>
                {status === 'connected' ? '● Connected' : '○ Disconnected'}
                {window.self === window.top ? ' (Standalone)' : ''}
            </div>
        </div>
    )
}

export default App
