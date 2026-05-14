import { useEffect, useRef, useCallback, useState } from 'react'

interface UseWebSocketOptions {
    url: string
    onMessage: (message: any) => void
    onStatusChange?: (status: string) => void
}

export function useWebSocket({ url, onMessage, onStatusChange }: UseWebSocketOptions) {
    const ws = useRef<WebSocket | null>(null)
    const [status, setStatus] = useState('connecting')

    const connect = useCallback(() => {
        console.log(`[WhiteboardUI] Connecting to ${url}`)
        const socket = new WebSocket(url)

        socket.onopen = () => {
            setStatus('connected')
            onStatusChange?.('connected')
        }

        socket.onmessage = (event) => {
            try {
                const data = json_parse(event.data)
                onMessage(data)
            } catch (e) {
                console.error("Failed to parse WS message", e)
            }
        }

        socket.onclose = () => {
            setStatus('disconnected')
            onStatusChange?.('disconnected')
            // Simple exponential backoff or static retry
            setTimeout(connect, 3000)
        }

        ws.current = socket
    }, [url, onMessage, onStatusChange])

    useEffect(() => {
        connect()
        return () => ws.current?.close()
    }, [connect])

    const send = useCallback((message: any) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(message))
        }
    }, [])

    return { send, status }
}

function json_parse(str: string) {
    try {
        return JSON.parse(str)
    } catch (e) {
        return {}
    }
}
