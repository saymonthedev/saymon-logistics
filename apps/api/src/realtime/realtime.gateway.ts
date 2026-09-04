import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { parse as parseCookie } from 'cookie';
import type { Server, Socket } from 'socket.io';

export enum RealtimeEvent {
  ORDER_CREATED = 'order.created',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  ORDER_UPDATED = 'order.updated',
  INVENTORY_UPDATED = 'inventory.updated',
  ALERT_CREATED = 'alert.created',
  ALERT_RESOLVED = 'alert.resolved',
  WAVE_CREATED = 'wave.created',
  WAVE_UPDATED = 'wave.updated',
  TASK_UPDATED = 'task.updated',
}

/**
 * All authenticated staff (any role) share one operational view of the
 * warehouse, so events are broadcast to every connected client rather than
 * scoped per-user — the frontend decides what to highlight. Authorization
 * for *actions* is still enforced entirely over REST by RolesGuard.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      this.logger.debug(`Client connected: ${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  emit(event: RealtimeEvent, payload: unknown) {
    this.server?.emit(event, payload);
  }

  private extractToken(client: Socket): string {
    const cookieHeader = client.handshake.headers.cookie;
    const cookieName = process.env.COOKIE_NAME ?? 'saymon_session';
    if (cookieHeader) {
      const parsed = parseCookie(cookieHeader);
      if (parsed[cookieName]) {
        return parsed[cookieName];
      }
    }
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) {
      return authToken;
    }
    throw new Error('No auth token provided');
  }
}
