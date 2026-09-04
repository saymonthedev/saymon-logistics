'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, EmptyState, PageHeader, Pagination, Spinner } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import type { AuditLog, PaginatedResult } from '@/lib/types';

const PAGE_SIZE = 25;

export default function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', { entityType, action, page }],
    queryFn: () =>
      api.get<PaginatedResult<AuditLog>>('/audit-logs', {
        entityType: entityType || undefined,
        action: action || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  return (
    <div>
      <PageHeader title="Auditoria" description="Histórico de ações importantes realizadas na plataforma" />

      <Card className="mb-4 flex flex-wrap gap-3 p-4">
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={entityType}
          onChange={(e) => {
            setPage(1);
            setEntityType(e.target.value);
          }}
        >
          <option value="">Toda entidade</option>
          <option value="Order">Pedido</option>
          <option value="Product">Produto</option>
          <option value="User">Usuário</option>
          <option value="Carrier">Transportadora</option>
          <option value="PickingWave">Onda de separação</option>
          <option value="PickingTask">Tarefa de separação</option>
          <option value="Alert">Alerta</option>
        </select>
        <input
          placeholder="Buscar por ação (ex.: ORDER_STATUS_CHANGED)"
          className="min-w-[280px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
        />
      </Card>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum registro encontrado" />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {data.data.map((log) => (
              <li key={log.id} className="px-4 py-3">
                <button
                  className="flex w-full items-start justify-between gap-4 text-left"
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <div>
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{log.user?.name ?? 'Sistema'}</span> — {log.action}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {log.entityType} · {log.entityId} · {formatDateTime(log.createdAt)}
                      {log.ipAddress && ` · ${log.ipAddress}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{expanded === log.id ? 'ocultar' : 'detalhes'}</span>
                </button>
                {expanded === log.id && (
                  <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 text-xs md:grid-cols-2">
                    <div>
                      <p className="mb-1 font-medium text-slate-500">Valor anterior</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-slate-600">
                        {JSON.stringify(log.previousValue, null, 2) ?? '—'}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 font-medium text-slate-500">Novo valor</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-slate-600">
                        {JSON.stringify(log.newValue, null, 2) ?? '—'}
                      </pre>
                    </div>
                  </div>
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
