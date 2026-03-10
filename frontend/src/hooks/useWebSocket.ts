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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

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
        console.log('WebSocket message received:', message);
        onMessage(message);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err, event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnecting(false);
      // Don't call onError immediately - let onclose handle reconnection
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason || 'No reason');
      setIsConnected(false);
      setIsConnecting(false);
      
      // Only reconnect if it wasn't a normal closure (code 1000)
      if (event.code !== 1000) {
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connect();
        }, 3000);
      } else {
        console.log('WebSocket closed normally, not reconnecting');
      }
    };

    wsRef.current = ws;
  }, [articleId, onMessage, onError]);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
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
