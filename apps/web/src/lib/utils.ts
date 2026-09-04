import type { AlertSeverity, OrderPriority, OrderStatus, PickingTaskStatus, PickingWaveStatus, Role } from './types';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(value),
  );
}

export function timeAgo(value: string | Date): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.round(hours / 24);
  return `${days}d atrás`;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: 'Recebido',
  RESERVED: 'Reservado',
  PICKING: 'Separação',
  PACKED: 'Embalado',
  SHIPPED: 'Expedido',
  IN_TRANSIT: 'Em transporte',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  RECEIVED: 'bg-slate-100 text-slate-700 ring-slate-300',
  RESERVED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  PICKING: 'bg-amber-50 text-amber-700 ring-amber-200',
  PACKED: 'bg-violet-50 text-violet-700 ring-violet-200',
  SHIPPED: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  IN_TRANSIT: 'bg-blue-50 text-blue-700 ring-blue-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
};

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: ['RESERVED', 'CANCELLED'],
  RESERVED: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const TRANSITION_MIN_ROLE: Partial<Record<OrderStatus, Role[]>> = {
  RESERVED: ['OPERATOR', 'SUPERVISOR', 'ADMIN'],
  PICKING: ['OPERATOR', 'SUPERVISOR', 'ADMIN'],
  PACKED: ['OPERATOR', 'SUPERVISOR', 'ADMIN'],
  SHIPPED: ['OPERATOR', 'SUPERVISOR', 'ADMIN'],
  IN_TRANSIT: ['SUPERVISOR', 'ADMIN'],
  DELIVERED: ['SUPERVISOR', 'ADMIN'],
  CANCELLED: ['SUPERVISOR', 'ADMIN'],
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  'RECEIVED',
  'RESERVED',
  'PICKING',
  'PACKED',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
];

export const PRIORITY_LABEL: Record<OrderPriority, string> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const PRIORITY_COLOR: Record<OrderPriority, string> = {
  LOW: 'bg-slate-100 text-slate-600 ring-slate-300',
  NORMAL: 'bg-blue-50 text-blue-700 ring-blue-200',
  HIGH: 'bg-orange-50 text-orange-700 ring-orange-200',
  URGENT: 'bg-red-50 text-red-700 ring-red-300',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  OPERATOR: 'Operador',
};

export const WAVE_STATUS_LABEL: Record<PickingWaveStatus, string> = {
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
};

export const TASK_STATUS_LABEL: Record<PickingTaskStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
};

export const ALERT_SEVERITY_COLOR: Record<AlertSeverity, string> = {
  INFO: 'bg-slate-100 text-slate-700 ring-slate-300',
  WARNING: 'bg-amber-50 text-amber-700 ring-amber-200',
  CRITICAL: 'bg-red-50 text-red-700 ring-red-300',
};

export const ALERT_TYPE_LABEL: Record<string, string> = {
  LOW_STOCK: 'Estoque crítico',
  DELAYED_ORDER: 'Pedido atrasado',
  STUCK_ORDER: 'Pedido parado',
  RESERVATION_FAILURE: 'Falha de reserva',
  CARRIER_DELAY: 'Transportadora com atraso',
};
