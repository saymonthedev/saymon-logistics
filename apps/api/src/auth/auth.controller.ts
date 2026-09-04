import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { parseDurationMs } from './parse-duration';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateCredentials(dto.email, dto.password);
    const token = this.authService.issueToken(user);

    res.cookie(this.config.get<string>('COOKIE_NAME') ?? 'saymon_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: parseDurationMs(this.config.get<string>('JWT_EXPIRES_IN') ?? '8h'),
      path: '/',
    });

    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.config.get<string>('COOKIE_NAME') ?? 'saymon_session', { path: '/' });
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
