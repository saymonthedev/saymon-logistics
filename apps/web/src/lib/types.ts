export type Role = 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';

export type OrderStatus =
  | 'RECEIVED'
  | 'RESERVED'
  | 'PICKING'
  | 'PACKED'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type PickingWaveStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
export type PickingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export type AlertType =
  | 'LOW_STOCK'
  | 'DELAYED_ORDER'
  | 'STUCK_ORDER'
  | 'RESERVATION_FAILURE'
  | 'CARRIER_DELAY';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'RESOLVED';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Carrier {
  id: string;
  name: string;
  createdAt: string;
  performance?: CarrierPerformance;
}

export interface CarrierPerformance {
  totalShipped: number;
  delivered: number;
  delayed: number;
  avgDeliveryHours: number | null;
  successRate: number;
  delayRate: number;
}

export interface Inventory {
  id: string;
  available: number;
  reserved: number;
  updatedAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  location: string | null;
  minStock: number;
  createdAt: string;
  updatedAt: string;
  inventory: Inventory | null;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice?: number;
  product?: Product;
}

export interface TrackingEvent {
  id: string;
  status: OrderStatus;
  description: string;
  createdAt: string;
}

export interface Shipment {
  id: string;
  trackingCode: string;
  shippedAt: string;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
}

export interface Order {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string | null;
  deliveryAddress: string;
  status: OrderStatus;
  priority: OrderPriority;
  totalValue: string;
  carrierId: string | null;
  carrier?: Carrier | null;
  assignedOperatorId: string | null;
  assignedOperator?: { id: string; name: string } | null;
  pickingWaveId?: string | null;
  pickingWave?: { id: string; code: string; status: PickingWaveStatus } | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  trackingEvents?: TrackingEvent[];
  shipment?: Shipment | null;
}

export interface PickingTask {
  id: string;
  waveId: string;
  productId: string;
  quantity: number;
  assignedToId: string | null;
  assignedTo?: { id: string; name: string } | null;
  status: PickingTaskStatus;
  completedAt: string | null;
  createdAt: string;
  product?: { id: string; sku: string; name: string; location: string | null };
  wave?: { id: string; code: string; status: PickingWaveStatus };
}

export interface PickingWave {
  id: string;
  code: string;
  status: PickingWaveStatus;
  createdById: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
  completedAt: string | null;
  orders?: { id: string; number: string; customerName: string; status: OrderStatus; priority: OrderPriority }[];
  tasks?: PickingTask[];
  _count?: { orders: number; tasks: number };
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  entityType: string | null;
  entityId: string | null;
  status: AlertStatus;
  resolvedBy?: { id: string; name: string } | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  user?: { id: string; name: string; email: string; role: Role } | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface DashboardMetrics {
  summary: {
    receivedToday: number;
    picking: number;
    awaitingPackaging: number;
    inTransit: number;
    deliveredToday: number;
    delayedOrders: number;
    criticalStock: number;
    onTimeDeliveryRate: number | null;
  };
  charts: {
    ordersByHour: { hour: number; count: number }[];
    ordersByStatus: { status: OrderStatus; count: number }[];
    ordersByCarrier: { carrierId: string | null; carrierName: string; count: number }[];
    topPickedProducts: { productId: string; sku: string; name: string; quantity: number }[];
    delayRateByCarrier: { carrierId: string; carrierName: string; delayRate: number }[];
  };
}
