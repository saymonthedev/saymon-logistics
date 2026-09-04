'use client';

import { cn, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, PRIORITY_COLOR, PRIORITY_LABEL } from '@/lib/utils';
import type { OrderPriority, OrderStatus } from '@/lib/types';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const toneClass = {
    default: 'text-slate-900',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    success: 'text-emerald-600',
  }[tone];

  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold', toneClass)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', ORDER_STATUS_COLOR[status])}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: OrderPriority }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', PRIORITY_COLOR[priority])}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600', className)}
    />
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="text-sm text-slate-500">
        Página {page} de {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
      >
        Próxima
      </button>
    </div>
  );
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const variantClass = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant];

  return (
    <button
      className={cn(
        'rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variantClass,
        className,
      )}
      {...props}
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
