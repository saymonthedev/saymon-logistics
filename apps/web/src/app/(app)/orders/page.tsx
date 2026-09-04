'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, PageHeader, Pagination, PriorityBadge, StatusBadge, Spinner, EmptyState } from '@/components/ui';
import { CreateOrderModal } from '@/components/create-order-modal';
import { formatCurrency, formatDateTime, ORDER_STATUS_ORDER, ORDER_STATUS_LABEL, PRIORITY_LABEL } from '@/lib/utils';
import type { Carrier, Order, OrderPriority, OrderStatus, PaginatedResult, UserRecord } from '@/lib/types';

const PAGE_SIZE = 15;

export default function OrdersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [priority, setPriority] = useState<OrderPriority | ''>('');
  const [carrierId, setCarrierId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: [
      'orders',
      { search, status, priority, carrierId, operatorId, dateFrom, dateTo, sortBy, sortDir, page },
    ],
    queryFn: () =>
      api.get<PaginatedResult<Order>>('/orders', {
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
        carrierId: carrierId || undefined,
        assignedOperatorId: operatorId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const { data: carriers } = useQuery({
    queryKey: ['carriers'],
    queryFn: () => api.get<Carrier[]>('/carriers'),
  });

  const { data: operators } = useQuery({
    queryKey: ['users', { role: 'OPERATOR' }],
    queryFn: () => api.get<PaginatedResult<UserRecord>>('/users', { role: 'OPERATOR', pageSize: 100 }),
    enabled: canManage,
  });

  const bulkPriority = useMutation({
    mutationFn: (p: OrderPriority) => api.patch('/orders/bulk/priority', { orderIds: [...selected], priority: p }),
    onSuccess: () => {
      toast.success('Prioridade atualizada em lote');
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao atualizar prioridade'),
  });

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = useMemo(
    () => (query.data?.data.length ?? 0) > 0 && query.data!.data.every((o) => selected.has(o.id)),
    [query.data, selected],
  );

  const columns: { key: string; label: string; sortable?: boolean }[] = [
    { key: 'number', label: 'Pedido', sortable: true },
    { key: 'customerName', label: 'Cliente', sortable: true },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Prioridade' },
    { key: 'carrier', label: 'Transportadora' },
    { key: 'totalValue', label: 'Valor', sortable: true },
    { key: 'createdAt', label: 'Criado em', sortable: true },
  ];

  return (
    <div>
      <PageHeader
        title="Central de pedidos"
        description="Busca, filtros, ordenação e ações em lote"
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Novo pedido</Button>}
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <input
            placeholder="Buscar por número ou cliente"
            className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 lg:col-span-2"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as OrderStatus | '');
            }}
          >
            <option value="">Todos os status</option>
            {ORDER_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={priority}
            onChange={(e) => {
              setPage(1);
              setPriority(e.target.value as OrderPriority | '');
            }}
          >
            <option value="">Toda prioridade</option>
            {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as OrderPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={carrierId}
            onChange={(e) => {
              setPage(1);
              setCarrierId(e.target.value);
            }}
          >
            <option value="">Toda transportadora</option>
            {carriers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {canManage && (
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={operatorId}
              onChange={(e) => {
                setPage(1);
                setOperatorId(e.target.value);
              }}
            >
              <option value="">Todo operador</option>
              {operators?.data.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => {
              setPage(1);
              setDateFrom(e.target.value);
            }}
          />
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={dateTo}
            onChange={(e) => {
              setPage(1);
              setDateTo(e.target.value);
            }}
          />
        </div>
      </Card>

      {canManage && selected.size > 0 && (
        <Card className="mb-4 flex items-center gap-3 p-3">
          <span className="text-sm text-slate-600">{selected.size} pedido(s) selecionado(s)</span>
          <span className="text-sm text-slate-400">Alterar prioridade:</span>
          {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as OrderPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => bulkPriority.mutate(p)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-slate-400 hover:text-slate-600">
            limpar seleção
          </button>
        </Card>
      )}

      <Card>
        {query.isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : !query.data || query.data.data.length === 0 ? (
          <EmptyState title="Nenhum pedido encontrado" description="Ajuste os filtros ou crie um novo pedido" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  {canManage && (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(allSelected ? new Set() : new Set(query.data!.data.map((o) => o.id)))
                        }
                      />
                    </th>
                  )}
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={col.sortable ? 'cursor-pointer select-none px-4 py-3 hover:text-slate-700' : 'px-4 py-3'}
                      onClick={() => col.sortable && toggleSort(col.key)}
                    >
                      {col.label}
                      {col.sortable && sortBy === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data.data.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    {canManage && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(order.id)}
                          onChange={() => toggleSelected(order.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-brand-700">
                      <Link href={`/orders/${order.id}`}>{order.number}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.customerName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={order.priority} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{order.carrier?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(order.totalValue)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {query.data && (
          <Pagination page={query.data.meta.page} totalPages={query.data.meta.totalPages} onChange={setPage} />
        )}
      </Card>

      <CreateOrderModal open={createOpen} onClose={() => setCreateOpen(false)} carriers={carriers ?? []} />
    </div>
  );
}
