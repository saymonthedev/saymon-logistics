import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let jwtService: { sign: jest.Mock };
  let service: AuthService;

  const activeUser = {
    id: 'user-1',
    name: 'Ana Diretoria',
    email: 'admin@saymon.com',
    passwordHash: 'hashed-password',
    role: Role.ADMIN,
    active: true,
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );
    jest.clearAllMocks();
  });

  describe('validateCredentials', () => {
    it('returns the authenticated user when the email and password are correct', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(activeUser as never);
      mockedBcrypt.compare.mockResolvedValueOnce(true as never);

      const result = await service.validateCredentials('admin@saymon.com', 'senha123');

      expect(result).toEqual({
        id: activeUser.id,
        email: activeUser.email,
        name: activeUser.name,
        role: activeUser.role,
      });
    });

    it('rejects login for an email that does not exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      await expect(service.validateCredentials('ghost@saymon.com', 'whatever')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects login when the password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(activeUser as never);
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      await expect(
        service.validateCredentials('admin@saymon.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login for a deactivated account even with the correct password', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...activeUser, active: false } as never);
      mockedBcrypt.compare.mockResolvedValueOnce(true as never);

      await expect(service.validateCredentials('admin@saymon.com', 'senha123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('still runs a bcrypt.compare against a dummy hash for an unknown email, to avoid a timing side-channel', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      await expect(service.validateCredentials('ghost@saymon.com', 'whatever')).rejects.toThrow();
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('whatever', expect.any(String));
    });
  });

  describe('issueToken', () => {
    it('signs a JWT payload containing the user id, email, name and role', () => {
      const token = service.issueToken({
        id: activeUser.id,
        email: activeUser.email,
        name: activeUser.name,
        role: activeUser.role,
      });

      expect(token).toBe('signed.jwt.token');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: activeUser.id,
        email: activeUser.email,
        name: activeUser.name,
        role: activeUser.role,
      });
    });
  });
});
