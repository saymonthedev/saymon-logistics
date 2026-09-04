import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

function cookieExtractor(req: Request): string | null {
  const cookieName = process.env.COOKIE_NAME ?? 'saymon_session';
  return req?.cookies?.[cookieName] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  /**
   * Re-reads the user from the database on every request instead of trusting
   * the token payload, so a deactivated account or a role change takes
   * effect immediately rather than after the token expires.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Account is not active');
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
