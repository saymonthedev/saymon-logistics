'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { Button, Modal } from '@/components/ui';
import type { Carrier, PaginatedResult, Product } from '@/lib/types';

const itemSchema = z.object({
  productId: z.string().min(1, 'Selecione um produto'),
  quantity: z.coerce.number().int().min(1, 'Mín. 1'),
  unitPrice: z.coerce.number().min(0, 'Inválido'),
});

const orderSchema = z.object({
  customerName: z.string().min(2, 'Informe o cliente'),
  customerEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  deliveryAddress: z.string().min(5, 'Informe o endereço'),
  carrierId: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  estimatedDeliveryAt: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Adicione ao menos um item'),
});
type OrderForm = z.infer<typeof orderSchema>;

export function CreateOrderModal({
  open,
  onClose,
  carriers,
}: {
  open: boolean;
  onClose: () => void;
  carriers: Carrier[];
}) {
  const queryClient = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ['inventory', { forOrderForm: true }],
    queryFn: () => api.get<PaginatedResult<Product>>('/inventory', { pageSize: 200 }),
    enabled: open,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { priority: 'NORMAL', items: [{ productId: '', quantity: 1, unitPrice: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const mutation = useMutation({
    mutationFn: (values: OrderForm) =>
      api.post('/orders', {
        ...values,
        customerEmail: values.customerEmail || undefined,
        carrierId: values.carrierId || undefined,
        estimatedDeliveryAt: values.estimatedDeliveryAt ? new Date(values.estimatedDeliveryAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      toast.success('Pedido criado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      reset({ priority: 'NORMAL', items: [{ productId: '', quantity: 1, unitPrice: 0 }] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Falha ao criar pedido'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Novo pedido">
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Cliente</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register('customerName')} />
            {errors.customerName && <p className="mt-1 text-xs text-red-600">{errors.customerName.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Email (opcional)</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register('customerEmail')} />
            {errors.customerEmail && <p className="mt-1 text-xs text-red-600">{errors.customerEmail.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Endereço de entrega</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register('deliveryAddress')} />
            {errors.deliveryAddress && <p className="mt-1 text-xs text-red-600">{errors.deliveryAddress.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Prioridade</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register('priority')}>
              <option value="LOW">Baixa</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Transportadora (opcional)</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register('carrierId')}>
              <option value="">—</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Prazo estimado (opcional)</label>
            <input type="datetime-local" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register('estimatedDeliveryAt')} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Itens do pedido</label>
            <button
              type="button"
              onClick={() => append({ productId: '', quantity: 1, unitPrice: 0 })}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              + adicionar item
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <select
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  {...register(`items.${index}.productId` as const)}
                >
                  <option value="">Selecione o produto</option>
                  {products?.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="Qtd"
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  {...register(`items.${index}.quantity` as const)}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Preço"
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  {...register(`items.${index}.unitPrice` as const)}
                />
                <button
                  type="button"
                  onClick={() => fields.length > 1 && remove(index)}
                  className="text-slate-400 hover:text-red-600"
                  aria-label="Remover item"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {errors.items && !Array.isArray(errors.items) && (
            <p className="mt-1 text-xs text-red-600">{errors.items.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? 'Criando...' : 'Criar pedido'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
