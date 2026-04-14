import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '@/types';

interface UseWebSocketOptions {
  articleId: string;
  onMessage: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({ articleId, onMessage, onError }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;

  /** Set when a user_message is sent; used for dev latency logs (first thinking / first text). */
  const userTurnStartRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const ws = new WebSocket(`${wsUrl}/ws/chat/${articleId}`);

    ws.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        const t0 = userTurnStartRef.current;
        if (t0 != null && typeof performance !== 'undefined') {
          const elapsed = Math.round(performance.now() - t0);
          if (message.type === 'thinking') {
            console.info(`[latency] first_thinking_ms=${elapsed}`);
          }
          if (message.type === 'text') {
            console.info(`[latency] first_assistant_text_ms=${elapsed}`);
            userTurnStartRef.current = null;
          }
          if (message.type === 'error') {
            console.info(`[latency] error_after_ms=${elapsed}`);
            userTurnStartRef.current = null;
          }
        }
        console.log('WebSocket message received:', message);
        onMessageRef.current(message);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err, event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnecting(false);
      onErrorRef.current?.(error);
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason || 'No reason');
      setIsConnected(false);
      setIsConnecting(false);

      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connect();
        }, 3000);
      } else {
        console.log('WebSocket closed normally, not reconnecting');
      }
    };

    wsRef.current = ws;
  }, [articleId]);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (typeof performance !== 'undefined') {
        userTurnStartRef.current = performance.now();
      }
      const payload = {
        type: 'user_message',
        content: message,
      };
      console.log('Sending WebSocket message:', payload);
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.warn('WebSocket is not connected. State:', wsRef.current?.readyState);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    sendMessage,
    connect,
    disconnect,
  };
}
