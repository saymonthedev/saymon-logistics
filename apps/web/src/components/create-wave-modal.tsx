'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { Button, Modal } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { Order, PaginatedResult } from '@/lib/types';

export function CreateWaveModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { status: 'RESERVED', forWave: true }],
    queryFn: () => api.get<PaginatedResult<Order>>('/orders', { status: 'RESERVED', pageSize: 100 }),
    enabled: open,
  });

  const eligibleOrders = (data?.data ?? []).filter((o) => !o.pickingWaveId);

  const mutation = useMutation({
    mutationFn: () => api.post('/picking-waves', { orderIds: [...selected] }),
    onSuccess: () => {
      toast.success('Onda de separação criada');
      queryClient.invalidateQueries({ queryKey: ['waves'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSelected(new Set());
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao criar onda'),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova onda de separação">
      <p className="mb-3 text-sm text-slate-500">
        Selecione os pedidos reservados que entrarão na onda. Os produtos serão agrupados automaticamente.
      </p>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-slate-400">Carregando pedidos...</p>
      ) : eligibleOrders.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Nenhum pedido reservado disponível</p>
      ) : (
        <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {eligibleOrders.map((order) => (
            <label key={order.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
              <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggle(order.id)} />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{order.number}</p>
                <p className="text-xs text-slate-500">{order.customerName}</p>
              </div>
              <span className="text-xs text-slate-400">{formatCurrency(order.totalValue)}</span>
            </label>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={selected.size === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Criando...' : `Criar onda (${selected.size})`}
        </Button>
      </div>
    </Modal>
  );
}
