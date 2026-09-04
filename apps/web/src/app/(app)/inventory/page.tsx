'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, EmptyState, Modal, PageHeader, Pagination, Spinner } from '@/components/ui';
import { cn, formatDateTime } from '@/lib/utils';
import type { PaginatedResult, Product } from '@/lib/types';

const PAGE_SIZE = 20;

export default function InventoryPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [belowMinStock, setBelowMinStock] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', { search, belowMinStock, page }],
    queryFn: () =>
      api.get<PaginatedResult<Product>>('/inventory', {
        search: search || undefined,
        belowMinStock: belowMinStock || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  return (
    <div>
      <PageHeader
        title="Estoque"
        description="Disponível, reservado e localização por SKU"
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Novo produto</Button>}
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <input
          placeholder="Buscar por SKU ou nome"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={belowMinStock}
            onChange={(e) => {
              setPage(1);
              setBelowMinStock(e.target.checked);
            }}
          />
          Apenas estoque crítico
        </label>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : !data || data.data.length === 0 ? (
          <EmptyState title="Nenhum produto encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Localização</th>
                  <th className="px-4 py-3">Disponível</th>
                  <th className="px-4 py-3">Reservado</th>
                  <th className="px-4 py-3">Mínimo</th>
                  <th className="px-4 py-3">Atualizado</th>
                  {canManage && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((product) => {
                  const critical = (product.inventory?.available ?? 0) <= product.minStock;
                  return (
                    <tr key={product.id} className={cn(critical && 'bg-red-50/40')}>
                      <td className="px-4 py-3 font-medium text-slate-800">{product.sku}</td>
                      <td className="px-4 py-3 text-slate-700">{product.name}</td>
                      <td className="px-4 py-3 text-slate-500">{product.location ?? '—'}</td>
                      <td className={cn('px-4 py-3 font-medium', critical ? 'text-red-600' : 'text-slate-700')}>
                        {product.inventory?.available ?? 0}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{product.inventory?.reserved ?? 0}</td>
                      <td className="px-4 py-3 text-slate-500">{product.minStock}</td>
                      <td className="px-4 py-3 text-slate-400">{formatDateTime(product.inventory?.updatedAt)}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setAdjustProduct(product)}
                            className="text-xs font-medium text-brand-600 hover:text-brand-700"
                          >
                            Ajustar
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />}
      </Card>

      <CreateProductModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {adjustProduct && <AdjustStockModal product={adjustProduct} onClose={() => setAdjustProduct(null)} />}
    </div>
  );
}

function CreateProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ sku: '', name: '', location: '', minStock: 0, initialAvailable: 0 });

  const mutation = useMutation({
    mutationFn: () => api.post('/inventory', form),
    onSuccess: () => {
      toast.success('Produto cadastrado');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setForm({ sku: '', name: '', location: '', minStock: 0, initialAvailable: 0 });
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao cadastrar produto'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Novo produto">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">SKU</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nome</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Localização</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="A-04-12"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Estoque mínimo</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Estoque inicial</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.initialAvailable}
              onChange={(e) => setForm({ ...form, initialAvailable: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.sku || !form.name || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Salvando...' : 'Cadastrar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AdjustStockModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.patch(`/inventory/${product.sku}/adjust`, { delta, reason: reason || undefined }),
    onSuccess: () => {
      toast.success('Estoque ajustado');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao ajustar estoque'),
  });

  return (
    <Modal open onClose={onClose} title={`Ajustar estoque — ${product.sku}`}>
      <p className="mb-3 text-sm text-slate-500">
        Disponível atual: <span className="font-medium text-slate-700">{product.inventory?.available ?? 0}</span>
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Ajuste (positivo para entrada, negativo para saída/avaria)
          </label>
          <input
            type="number"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Motivo</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ex.: recebimento de fornecedor, contagem de ciclo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={delta === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Salvando...' : 'Confirmar ajuste'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
