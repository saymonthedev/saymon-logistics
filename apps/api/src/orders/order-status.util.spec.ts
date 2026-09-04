import { OrderStatus, Role } from '@prisma/client';
import { assertRoleCanTransition, assertValidTransition, canTransition } from './order-status.util';

describe('order-status.util', () => {
  describe('canTransition / assertValidTransition', () => {
    it('allows the documented forward path through the pipeline', () => {
      expect(canTransition(OrderStatus.RECEIVED, OrderStatus.RESERVED)).toBe(true);
      expect(canTransition(OrderStatus.RESERVED, OrderStatus.PICKING)).toBe(true);
      expect(canTransition(OrderStatus.PICKING, OrderStatus.PACKED)).toBe(true);
      expect(canTransition(OrderStatus.PACKED, OrderStatus.SHIPPED)).toBe(true);
      expect(canTransition(OrderStatus.SHIPPED, OrderStatus.IN_TRANSIT)).toBe(true);
      expect(canTransition(OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED)).toBe(true);
    });

    it('rejects skipping stages, e.g. RECEIVED straight to DELIVERED', () => {
      expect(canTransition(OrderStatus.RECEIVED, OrderStatus.DELIVERED)).toBe(false);
      expect(() => assertValidTransition(OrderStatus.RECEIVED, OrderStatus.DELIVERED)).toThrow(
        'Cannot transition order from RECEIVED to DELIVERED',
      );
    });

    it('rejects moving backwards in the pipeline', () => {
      expect(canTransition(OrderStatus.PACKED, OrderStatus.PICKING)).toBe(false);
      expect(canTransition(OrderStatus.SHIPPED, OrderStatus.RESERVED)).toBe(false);
    });

    it('allows cancellation up through PACKED but not after dispatch', () => {
      expect(canTransition(OrderStatus.RECEIVED, OrderStatus.CANCELLED)).toBe(true);
      expect(canTransition(OrderStatus.RESERVED, OrderStatus.CANCELLED)).toBe(true);
      expect(canTransition(OrderStatus.PICKING, OrderStatus.CANCELLED)).toBe(true);
      expect(canTransition(OrderStatus.PACKED, OrderStatus.CANCELLED)).toBe(true);
      expect(canTransition(OrderStatus.SHIPPED, OrderStatus.CANCELLED)).toBe(false);
      expect(canTransition(OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED)).toBe(false);
    });

    it('treats DELIVERED and CANCELLED as terminal states', () => {
      expect(canTransition(OrderStatus.DELIVERED, OrderStatus.RECEIVED)).toBe(false);
      expect(canTransition(OrderStatus.CANCELLED, OrderStatus.RECEIVED)).toBe(false);
    });
  });

  describe('assertRoleCanTransition (authorization)', () => {
    it('lets an OPERATOR drive the warehouse steps up through SHIPPED', () => {
      expect(() => assertRoleCanTransition(OrderStatus.PICKING, Role.OPERATOR)).not.toThrow();
      expect(() => assertRoleCanTransition(OrderStatus.PACKED, Role.OPERATOR)).not.toThrow();
      expect(() => assertRoleCanTransition(OrderStatus.SHIPPED, Role.OPERATOR)).not.toThrow();
    });

    it('forbids an OPERATOR from marking an order IN_TRANSIT, DELIVERED, or CANCELLED', () => {
      expect(() => assertRoleCanTransition(OrderStatus.IN_TRANSIT, Role.OPERATOR)).toThrow(
        'Role OPERATOR cannot set order status to IN_TRANSIT',
      );
      expect(() => assertRoleCanTransition(OrderStatus.DELIVERED, Role.OPERATOR)).toThrow();
      expect(() => assertRoleCanTransition(OrderStatus.CANCELLED, Role.OPERATOR)).toThrow();
    });

    it('allows a SUPERVISOR and an ADMIN to perform every transition', () => {
      for (const to of Object.values(OrderStatus)) {
        expect(() => assertRoleCanTransition(to, Role.SUPERVISOR)).not.toThrow();
        expect(() => assertRoleCanTransition(to, Role.ADMIN)).not.toThrow();
      }
    });
  });
});
