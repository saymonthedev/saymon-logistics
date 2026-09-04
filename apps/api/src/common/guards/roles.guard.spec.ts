import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextWithUser(user: { role: Role } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('RolesGuard (authorization)', () => {
  it('allows the request through when the route declares no required roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithUser({ role: Role.OPERATOR }))).toBe(true);
  });

  it('denies an OPERATOR access to a route restricted to SUPERVISOR/ADMIN', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.SUPERVISOR, Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextWithUser({ role: Role.OPERATOR }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a SUPERVISOR through a route restricted to SUPERVISOR/ADMIN', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.SUPERVISOR, Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithUser({ role: Role.SUPERVISOR }))).toBe(true);
  });

  it('denies access when there is no authenticated user on the request at all', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });
});
