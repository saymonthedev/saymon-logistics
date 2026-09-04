'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, EmptyState, Modal, PageHeader, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Carrier } from '@/lib/types';

export default function CarriersPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';
  const [createOpen, setCreateOpen] = useState(false);

  const { data: carriers, isLoading } = useQuery({
    queryKey: ['carriers'],
    queryFn: () => api.get<Carrier[]>('/carriers'),
  });

  return (
    <div>
      <PageHeader
        title="Transportadoras"
        description="Ranking de desempenho por prazo, atraso e taxa de sucesso"
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Nova transportadora</Button>}
      />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : !carriers || carriers.length === 0 ? (
        <Card>
          <EmptyState title="Nenhuma transportadora cadastrada" />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Transportadora</th>
                  <th className="px-4 py-3">Enviados</th>
                  <th className="px-4 py-3">Entregues</th>
                  <th className="px-4 py-3">Atrasados</th>
                  <th className="px-4 py-3">Prazo médio</th>
                  <th className="px-4 py-3">Taxa de sucesso</th>
                  <th className="px-4 py-3">Taxa de atraso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {carriers.map((carrier, index) => (
                  <tr key={carrier.id}>
                    <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{carrier.name}</td>
                    <td className="px-4 py-3 text-slate-500">{carrier.performance?.totalShipped ?? 0}</td>
                    <td className="px-4 py-3 text-slate-500">{carrier.performance?.delivered ?? 0}</td>
                    <td className="px-4 py-3 text-slate-500">{carrier.performance?.delayed ?? 0}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {carrier.performance?.avgDeliveryHours !== null && carrier.performance?.avgDeliveryHours !== undefined
                        ? `${carrier.performance.avgDeliveryHours}h`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'font-medium',
                          (carrier.performance?.successRate ?? 0) >= 80 ? 'text-emerald-600' : 'text-amber-600',
                        )}
                      >
                        {carrier.performance?.successRate ?? 0}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('font-medium', (carrier.performance?.delayRate ?? 0) > 30 ? 'text-red-600' : 'text-slate-500')}>
                        {carrier.performance?.delayRate ?? 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateCarrierModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateCarrierModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/carriers', { name }),
    onSuccess: () => {
      toast.success('Transportadora cadastrada');
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      setName('');
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao cadastrar transportadora'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Nova transportadora">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nome</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={name.length < 2 || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Salvando...' : 'Cadastrar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
