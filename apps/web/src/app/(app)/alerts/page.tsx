'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, EmptyState, PageHeader, Pagination, Spinner } from '@/components/ui';
import { ALERT_SEVERITY_COLOR, ALERT_TYPE_LABEL, cn, formatDateTime } from '@/lib/utils';
import type { Alert, AlertStatus, PaginatedResult } from '@/lib/types';

const PAGE_SIZE = 20;

export default function AlertsPage() {
  const { user } = useAuth();
  const canResolve = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<AlertStatus | ''>('OPEN');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', { status, page }],
    queryFn: () => api.get<PaginatedResult<Alert>>('/alerts', { status: status || undefined, page, pageSize: PAGE_SIZE }),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => api.patch(`/alerts/${id}/resolve`),
    onSuccess: () => {
      toast.success('Alerta resolvido');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao resolver alerta'),
  });

  return (
    <div>
      <PageHeader title="Central de alertas" description="Problemas operacionais detectados automaticamente" />

      <Card className="mb-4 flex items-center gap-3 p-4">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { value: 'OPEN', label: 'Abertos' },
              { value: 'RESOLVED', label: 'Resolvidos' },
              { value: '', label: 'Todos' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                setPage(1);
                setStatus(opt.value);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                status === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum alerta encontrado" description="Tudo certo por aqui" />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {data.data.map((alert) => (
              <li key={alert.id} className="flex items-start justify-between gap-4 px-4 py-4">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                      ALERT_SEVERITY_COLOR[alert.severity],
                    )}
                  >
                    {ALERT_TYPE_LABEL[alert.type] ?? alert.type}
                  </span>
                  <div>
                    <p className="text-sm text-slate-800">{alert.message}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDateTime(alert.createdAt)}
                      {alert.status === 'RESOLVED' && alert.resolvedBy && ` · resolvido por ${alert.resolvedBy.name}`}
                    </p>
                  </div>
                </div>
                {alert.status === 'OPEN' && canResolve && (
                  <Button variant="secondary" disabled={resolve.isPending} onClick={() => resolve.mutate(alert.id)}>
                    Resolver
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
        </Card>
      )}
    </div>
  );
}
