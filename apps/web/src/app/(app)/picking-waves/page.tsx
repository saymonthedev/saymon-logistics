'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, EmptyState, PageHeader, Spinner } from '@/components/ui';
import { CreateWaveModal } from '@/components/create-wave-modal';
import { cn, formatDateTime, WAVE_STATUS_LABEL } from '@/lib/utils';
import type { PaginatedResult, PickingWave, PickingWaveStatus } from '@/lib/types';

const WAVE_STATUS_COLOR: Record<PickingWaveStatus, string> = {
  OPEN: 'bg-slate-100 text-slate-700 ring-slate-300',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 ring-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export default function PickingWavesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['waves'],
    queryFn: () => api.get<PaginatedResult<PickingWave>>('/picking-waves', { pageSize: 50 }),
  });

  return (
    <div>
      <PageHeader
        title="Ondas de separação"
        description="Agrupe pedidos reservados em ondas para separar por produto, não por pedido"
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Nova onda</Button>}
      />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <EmptyState title="Nenhuma onda criada" description="Crie uma onda a partir de pedidos reservados" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((wave) => (
            <Link key={wave.id} href={`/picking-waves/${wave.id}`}>
              <Card className="h-full p-4 transition hover:border-brand-300 hover:shadow-md">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{wave.code}</p>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                      WAVE_STATUS_COLOR[wave.status],
                    )}
                  >
                    {WAVE_STATUS_LABEL[wave.status]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-500">
                  <p>{wave._count?.orders ?? 0} pedidos</p>
                  <p>{wave._count?.tasks ?? 0} SKUs</p>
                </div>
                <p className="mt-3 text-xs text-slate-400">Criada por {wave.createdBy?.name} em {formatDateTime(wave.createdAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateWaveModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
