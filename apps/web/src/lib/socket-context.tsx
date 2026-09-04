'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from './auth-context';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

const SocketContext = createContext<Socket | null>(null);

export function useRealtimeSocket(): Socket | null {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    const socket = io(`${WS_URL}/realtime`, { withCredentials: true, transports: ['websocket', 'polling'] });
    setSocket(socket);

    const invalidate = (keys: string[]) => keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

    socket.on('order.created', (payload: { number: string }) => {
      invalidate(['orders', 'dashboard']);
      toast.info(`Novo pedido recebido: ${payload.number}`);
    });
    socket.on('order.status_changed', () => invalidate(['orders', 'order', 'dashboard', 'waves', 'wave']));
    socket.on('order.updated', () => invalidate(['orders', 'order', 'dashboard']));
    socket.on('inventory.updated', (payload: { sku?: string; lowStock?: boolean }) => {
      invalidate(['inventory', 'product', 'dashboard']);
      if (payload.lowStock) toast.warning(`Estoque crítico: ${payload.sku}`);
    });
    socket.on('alert.created', (payload: { message?: string }) => {
      invalidate(['alerts', 'dashboard']);
      toast.warning(payload.message ?? 'Novo alerta operacional');
    });
    socket.on('alert.resolved', () => invalidate(['alerts', 'dashboard']));
    socket.on('wave.created', (payload: { code?: string }) => {
      invalidate(['waves', 'orders', 'dashboard']);
      toast.info(`Onda de separação criada: ${payload.code}`);
    });
    socket.on('wave.updated', () => invalidate(['waves', 'wave', 'orders', 'dashboard']));
    socket.on('task.updated', () => invalidate(['tasks', 'wave', 'inventory', 'dashboard']));

    return () => {
      socket.disconnect();
      setSocket(null);
    };
  }, [user, queryClient]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
