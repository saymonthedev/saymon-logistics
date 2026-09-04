'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { Card, PageHeader, Spinner, StatCard } from '@/components/ui';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '@/lib/utils';
import type { DashboardMetrics } from '@/lib/types';

const STATUS_HEX: Record<string, string> = {
  RECEIVED: '#94a3b8',
  RESERVED: '#6366f1',
  PICKING: '#f59e0b',
  PACKED: '#8b5cf6',
  SHIPPED: '#06b6d4',
  IN_TRANSIT: '#3b82f6',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardMetrics>('/dashboard/metrics'),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const { summary, charts } = data;

  return (
    <div>
      <PageHeader title="Dashboard operacional" description="Centro de controle da operação em tempo real" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Recebidos hoje" value={summary.receivedToday} />
        <StatCard label="Em separação" value={summary.picking} />
        <StatCard label="Aguard. embalagem" value={summary.awaitingPackaging} />
        <StatCard label="Em transporte" value={summary.inTransit} />
        <StatCard label="Entregues hoje" value={summary.deliveredToday} tone="success" />
        <StatCard label="Atrasados" value={summary.delayedOrders} tone={summary.delayedOrders > 0 ? 'danger' : 'default'} />
        <StatCard label="Estoque crítico" value={summary.criticalStock} tone={summary.criticalStock > 0 ? 'warning' : 'default'} />
        <StatCard
          label="Taxa no prazo"
          value={summary.onTimeDeliveryRate !== null ? `${summary.onTimeDeliveryRate}%` : '—'}
          tone={
            summary.onTimeDeliveryRate === null
              ? 'default'
              : summary.onTimeDeliveryRate >= 80
                ? 'success'
                : 'warning'
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Pedidos por hora (hoje)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.ordersByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} fontSize={11} stroke="#94a3b8" />
                <YAxis allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                <Tooltip labelFormatter={(h) => `${h}h`} />
                <Bar dataKey="count" name="Pedidos" fill="#3b6fe0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Pedidos por status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.ordersByStatus}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {charts.ordersByStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_HEX[entry.status] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value: string) => ORDER_STATUS_LABEL[value as keyof typeof ORDER_STATUS_LABEL] ?? value}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [value, ORDER_STATUS_LABEL[name as keyof typeof ORDER_STATUS_LABEL] ?? name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Pedidos por transportadora</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.ordersByCarrier} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                <YAxis type="category" dataKey="carrierName" width={140} fontSize={11} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="count" name="Pedidos" fill="#0891b2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Taxa de atraso por transportadora</h3>
          <div className="h-64">
            {charts.delayRateByCarrier.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem envios suficientes</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.delayRateByCarrier}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="carrierName" fontSize={11} stroke="#94a3b8" />
                  <YAxis unit="%" fontSize={11} stroke="#94a3b8" />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Atraso']} />
                  <Bar dataKey="delayRate" name="Atraso" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Produtos mais separados</h3>
          {charts.topPickedProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nenhuma separação concluída ainda</p>
          ) : (
            <div className="space-y-2">
              {charts.topPickedProducts.map((p) => {
                const max = charts.topPickedProducts[0]?.quantity || 1;
                return (
                  <div key={p.productId} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-500">{p.sku}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${(p.quantity / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-700">{p.quantity}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
