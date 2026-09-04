import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Deliberately returns the same generic error whether the email doesn't
   * exist or the password is wrong, and takes roughly constant time either
   * way, so failed login attempts can't be used to enumerate valid accounts.
   */
  async validateCredentials(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    const passwordHash = user?.passwordHash ?? '$2b$10$invalidsaltinvalidsaltinvalidsaltinvalidsal';
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    if (!user || !user.active || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  issueToken(user: AuthenticatedUser): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }
}
