'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, EmptyState, PageHeader, Spinner, StatusBadge } from '@/components/ui';
import { cn, formatDateTime, TASK_STATUS_LABEL, WAVE_STATUS_LABEL } from '@/lib/utils';
import type { PaginatedResult, PickingWave, PickingWaveStatus, UserRecord } from '@/lib/types';

const WAVE_STATUS_COLOR: Record<PickingWaveStatus, string> = {
  OPEN: 'bg-slate-100 text-slate-700 ring-slate-300',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 ring-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export default function PickingWaveDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';

  const { data: wave, isLoading } = useQuery({
    queryKey: ['wave', params.id],
    queryFn: () => api.get<PickingWave>(`/picking-waves/${params.id}`),
  });

  const { data: operators } = useQuery({
    queryKey: ['users', { role: 'OPERATOR' }],
    queryFn: () => api.get<PaginatedResult<UserRecord>>('/users', { role: 'OPERATOR', pageSize: 100 }),
    enabled: canManage,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['wave', params.id] });
    queryClient.invalidateQueries({ queryKey: ['waves'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const completeTask = useMutation({
    mutationFn: (taskId: string) => api.post(`/picking-tasks/${taskId}/complete`),
    onSuccess: () => {
      toast.success('Separação concluída — estoque atualizado');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao concluir tarefa'),
  });

  const assignTask = useMutation({
    mutationFn: ({ taskId, operatorId }: { taskId: string; operatorId: string }) =>
      api.patch(`/picking-tasks/${taskId}/assign`, { operatorId }),
    onSuccess: () => {
      toast.success('Tarefa atribuída');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao atribuir tarefa'),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!wave) return <EmptyState title="Onda não encontrada" />;

  const canCompleteTask = (assignedToId: string | null) =>
    canManage || !assignedToId || assignedToId === user?.id;

  return (
    <div>
      <button onClick={() => router.back()} className="mb-3 text-sm text-slate-500 hover:text-slate-700">
        ← Voltar
      </button>
      <PageHeader
        title={wave.code}
        description={`Criada por ${wave.createdBy?.name} em ${formatDateTime(wave.createdAt)}`}
        actions={
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
              WAVE_STATUS_COLOR[wave.status],
            )}
          >
            {WAVE_STATUS_LABEL[wave.status]}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Tarefas de separação por produto</h3>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">SKU / Produto</th>
                  <th className="pb-2">Localização</th>
                  <th className="pb-2">Qtd.</th>
                  <th className="pb-2">Responsável</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wave.tasks?.map((task) => (
                  <tr key={task.id}>
                    <td className="py-2">
                      <p className="font-medium text-slate-800">{task.product?.sku}</p>
                      <p className="text-xs text-slate-400">{task.product?.name}</p>
                    </td>
                    <td className="py-2 text-slate-500">{task.product?.location ?? '—'}</td>
                    <td className="py-2 font-medium text-slate-700">{task.quantity}</td>
                    <td className="py-2">
                      {canManage && task.status !== 'COMPLETED' ? (
                        <select
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                          value={task.assignedToId ?? ''}
                          onChange={(e) => e.target.value && assignTask.mutate({ taskId: task.id, operatorId: e.target.value })}
                        >
                          <option value="">Não atribuído</option>
                          {operators?.data.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-500">{task.assignedTo?.name ?? '—'}</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-500">{TASK_STATUS_LABEL[task.status]}</td>
                    <td className="py-2 text-right">
                      {task.status !== 'COMPLETED' && canCompleteTask(task.assignedToId) && (
                        <Button
                          variant="secondary"
                          disabled={completeTask.isPending}
                          onClick={() => completeTask.mutate(task.id)}
                        >
                          Concluir
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Pedidos na onda</h3>
          <ul className="space-y-2">
            {wave.orders?.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-brand-700">{order.number}</p>
                    <p className="text-xs text-slate-500">{order.customerName}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
