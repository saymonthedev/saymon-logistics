'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, EmptyState, PageHeader, PriorityBadge, StatusBadge, Spinner } from '@/components/ui';
import {
  formatCurrency,
  formatDateTime,
  ORDER_STATUS_LABEL,
  ORDER_TRANSITIONS,
  TRANSITION_MIN_ROLE,
} from '@/lib/utils';
import type { Carrier, Order, OrderStatus, PaginatedResult, UserRecord } from '@/lib/types';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', params.id],
    queryFn: () => api.get<Order>(`/orders/${params.id}`),
  });

  const { data: carriers } = useQuery({
    queryKey: ['carriers'],
    queryFn: () => api.get<Carrier[]>('/carriers'),
    enabled: canManage,
  });

  const { data: operators } = useQuery({
    queryKey: ['users', { role: 'OPERATOR' }],
    queryFn: () => api.get<PaginatedResult<UserRecord>>('/users', { role: 'OPERATOR', pageSize: 100 }),
    enabled: canManage,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', params.id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const updateStatus = useMutation({
    mutationFn: (status: OrderStatus) => api.patch(`/orders/${params.id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status atualizado');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao atualizar status'),
  });

  const retryReservation = useMutation({
    mutationFn: () => api.patch(`/orders/${params.id}/reserve`),
    onSuccess: () => {
      toast.success('Reserva reprocessada');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao reservar estoque'),
  });

  const assignOperator = useMutation({
    mutationFn: (operatorId: string) => api.patch(`/orders/${params.id}/assign-operator`, { operatorId }),
    onSuccess: () => {
      toast.success('Operador atribuído');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao atribuir operador'),
  });

  const assignCarrier = useMutation({
    mutationFn: (carrierId: string) => api.patch(`/orders/${params.id}/carrier`, { carrierId }),
    onSuccess: () => {
      toast.success('Transportadora atribuída');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao atribuir transportadora'),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!order) {
    return <EmptyState title="Pedido não encontrado" />;
  }

  const nextStatuses = ORDER_TRANSITIONS[order.status].filter((status) => {
    const allowedRoles = TRANSITION_MIN_ROLE[status];
    if (allowedRoles && user && !allowedRoles.includes(user.role)) return false;
    if (user?.role === 'OPERATOR' && order.assignedOperatorId !== user.id) return false;
    if (status === 'SHIPPED' && !order.carrierId) return false;
    return true;
  });

  return (
    <div>
      <button onClick={() => router.back()} className="mb-3 text-sm text-slate-500 hover:text-slate-700">
        ← Voltar
      </button>
      <PageHeader
        title={`Pedido ${order.number}`}
        description={`Criado em ${formatDateTime(order.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            <PriorityBadge priority={order.priority} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Itens do pedido</h3>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Produto</th>
                  <th className="pb-2">Qtd.</th>
                  <th className="pb-2">Preço unit.</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2">
                      {item.product?.sku} — {item.product?.name}
                    </td>
                    <td className="py-2">{item.quantity}</td>
                    <td className="py-2">{item.unitPrice !== undefined ? formatCurrency(item.unitPrice) : '—'}</td>
                    <td className="py-2 text-right">
                      {item.unitPrice !== undefined ? formatCurrency(item.unitPrice * item.quantity) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 text-right text-sm font-medium text-slate-500">
                    Total
                  </td>
                  <td className="pt-3 text-right text-sm font-semibold text-slate-900">
                    {formatCurrency(order.totalValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Linha do tempo</h3>
            {!order.trackingEvents || order.trackingEvents.length === 0 ? (
              <p className="text-sm text-slate-400">Sem eventos registrados</p>
            ) : (
              <ol className="space-y-3">
                {order.trackingEvents.map((event) => (
                  <li key={event.id} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{event.description}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(event.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Ações</h3>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.length === 0 && order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                <p className="text-xs text-slate-400">Nenhuma ação disponível para o seu perfil</p>
              )}
              {nextStatuses.map((status) => (
                <Button
                  key={status}
                  variant={status === 'CANCELLED' ? 'danger' : 'primary'}
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate(status)}
                >
                  {status === 'CANCELLED' ? 'Cancelar pedido' : `Marcar ${ORDER_STATUS_LABEL[status]}`}
                </Button>
              ))}
            </div>
            {order.status === 'RECEIVED' && canManage && (
              <button
                onClick={() => retryReservation.mutate()}
                disabled={retryReservation.isPending}
                className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Tentar reservar estoque novamente
              </button>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Cliente</h3>
            <p className="text-sm text-slate-700">{order.customerName}</p>
            {order.customerEmail && <p className="text-sm text-slate-500">{order.customerEmail}</p>}
            <p className="mt-2 text-sm text-slate-500">{order.deliveryAddress}</p>
            {order.estimatedDeliveryAt && (
              <p className="mt-2 text-xs text-slate-400">Prazo estimado: {formatDateTime(order.estimatedDeliveryAt)}</p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Transportadora</h3>
            {canManage ? (
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={order.carrierId ?? ''}
                onChange={(e) => e.target.value && assignCarrier.mutate(e.target.value)}
              >
                <option value="">Selecionar transportadora</option>
                {carriers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-slate-500">{order.carrier?.name ?? 'Não atribuída'}</p>
            )}
            {order.shipment && (
              <p className="mt-2 text-xs text-slate-400">Rastreio: {order.shipment.trackingCode}</p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Operador responsável</h3>
            {canManage ? (
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={order.assignedOperatorId ?? ''}
                onChange={(e) => e.target.value && assignOperator.mutate(e.target.value)}
              >
                <option value="">Selecionar operador</option>
                {operators?.data.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-slate-500">{order.assignedOperator?.name ?? 'Não atribuído'}</p>
            )}
          </Card>

          {order.pickingWave && (
            <Card className="p-4">
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Onda de separação</h3>
              <p className="text-sm text-brand-700">{order.pickingWave.code}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
