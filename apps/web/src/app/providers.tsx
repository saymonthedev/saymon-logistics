'use client';

import { Toaster } from 'sonner';
import { QueryProvider } from '@/lib/query-provider';
import { AuthProvider } from '@/lib/auth-context';
import { SocketProvider } from '@/lib/socket-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <SocketProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </SocketProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
