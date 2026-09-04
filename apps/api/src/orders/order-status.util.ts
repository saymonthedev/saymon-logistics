import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';

/**
 * The order lifecycle. Cancellation is only reachable up to PACKED — once an
 * order has physically left the building (SHIPPED) the warehouse can no
 * longer unilaterally cancel it, so IN_TRANSIT/DELIVERED are dead ends
 * except for the forward path.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: [OrderStatus.RESERVED, OrderStatus.CANCELLED],
  RESERVED: [OrderStatus.PICKING, OrderStatus.CANCELLED],
  PICKING: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  PACKED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.IN_TRANSIT],
  IN_TRANSIT: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Minimum role allowed to trigger each transition, keyed by destination
 * status. Forward warehouse steps (up through SHIPPED) can be driven by the
 * operator assigned to the order; cancelling and the post-dispatch carrier
 * updates (which in a real integration would arrive from the carrier
 * webhook, simulated here) are supervisor/admin-only.
 */
const TRANSITION_MIN_ROLE: Partial<Record<OrderStatus, Role[]>> = {
  [OrderStatus.RESERVED]: [Role.OPERATOR, Role.SUPERVISOR, Role.ADMIN],
  [OrderStatus.PICKING]: [Role.OPERATOR, Role.SUPERVISOR, Role.ADMIN],
  [OrderStatus.PACKED]: [Role.OPERATOR, Role.SUPERVISOR, Role.ADMIN],
  [OrderStatus.SHIPPED]: [Role.OPERATOR, Role.SUPERVISOR, Role.ADMIN],
  [OrderStatus.IN_TRANSIT]: [Role.SUPERVISOR, Role.ADMIN],
  [OrderStatus.DELIVERED]: [Role.SUPERVISOR, Role.ADMIN],
  [OrderStatus.CANCELLED]: [Role.SUPERVISOR, Role.ADMIN],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`Cannot transition order from ${from} to ${to}`);
  }
}

export function assertRoleCanTransition(to: OrderStatus, role: Role): void {
  const allowed = TRANSITION_MIN_ROLE[to];
  if (allowed && !allowed.includes(role)) {
    throw new ForbiddenException(`Role ${role} cannot set order status to ${to}`);
  }
}

export const TRACKING_DESCRIPTIONS: Record<OrderStatus, string> = {
  RECEIVED: 'Pedido recebido',
  RESERVED: 'Estoque reservado',
  PICKING: 'Separação iniciada',
  PACKED: 'Pedido embalado',
  SHIPPED: 'Pedido expedido',
  IN_TRANSIT: 'Saiu para entrega',
  DELIVERED: 'Pedido entregue',
  CANCELLED: 'Pedido cancelado',
};
