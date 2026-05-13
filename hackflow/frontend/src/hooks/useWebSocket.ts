import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { WsEvent } from '@/types';

type EventHandler = (payload: WsEvent['payload']) => void;

export function useWebSocket(
  path: string,
  handlers: Record<string, EventHandler>,
) {
  const { accessToken } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);

  // Keep handlers ref current
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (!accessToken) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const url = `${protocol}://${host}/ws${path}?token=${accessToken}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (ev: MessageEvent<string>) => {
      try {
        const event: WsEvent = JSON.parse(ev.data);
        const handler = handlersRef.current[event.event];
        if (handler) handler(event.payload);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = (ev) => {
      if (ev.code !== 1000) {
        // Reconnect with backoff
        setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [accessToken, path]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close(1000, 'unmount');
    };
  }, [connect]);

  return wsRef;
}
