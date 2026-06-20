import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { PRICE_UPDATE_EVENT } from '../../../market/domain/constants/events';
import { CURRENCY_UPDATE_EVENT } from '../../../currency/domain/constants/events';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../../../users/application/services/users.service';

interface SubscriptionPayload {
  topic: string;
  type?: 'stock' | 'forex';
}

const isAllowedOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allowed?: boolean) => void,
): void => {
  const origins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  callback(null, !origin || origins.includes(origin));
};

@Injectable()
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: isAllowedOrigin, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const authToken: unknown = socket.handshake.auth.token;
    const token = typeof authToken === 'string' ? authToken : undefined;
    if (!token) {
      socket.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (!Number.isInteger(payload.tokenVersion)) {
        throw new Error('El token no contiene una versión válida.');
      }
      const user = await this.usersService.findById(payload.sub);
      if ((user.tokenVersion ?? 0) !== payload.tokenVersion) {
        throw new Error('El token fue revocado.');
      }
      const socketData = socket.data as Record<string, unknown>;
      socketData.user = {
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion ?? 0,
      };
      void socket.join(`user:${user.id}`);
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, data: unknown): void {
    const payload = this.validateSubscription(data);
    const prefix = payload.type === 'forex' ? 'forex' : 'stock';
    const room = `${prefix}:${payload.topic}`;
    void client.join(room);
    this.logger.debug(`Client ${client.id} subscribed to ${room}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, data: unknown): void {
    const payload = this.validateSubscription(data);
    const prefix = payload.type === 'forex' ? 'forex' : 'stock';
    const room = `${prefix}:${payload.topic}`;
    void client.leave(room);
    this.logger.debug(`Client ${client.id} unsubscribed from ${room}`);
  }

  @OnEvent(PRICE_UPDATE_EVENT)
  handlePriceUpdate(
    quotes: Array<{
      symbol: string;
      close: number;
      dayChangePercentage?: number;
    }>,
  ): void {
    for (const quote of quotes) {
      this.server.to(`stock:${quote.symbol}`).emit('price_update', {
        symbol: quote.symbol,
        price: quote.close,
        dayChangePercentage: quote.dayChangePercentage,
        timestamp: new Date(),
      });
    }
  }

  @OnEvent(CURRENCY_UPDATE_EVENT)
  handleCurrencyUpdate(
    quotes: Array<{
      symbol: string;
      close: number;
      dayChangePercentage?: number;
    }>,
  ): void {
    for (const quote of quotes) {
      this.server.to(`forex:${quote.symbol}`).emit('price_update', {
        symbol: quote.symbol,
        price: quote.close,
        dayChangePercentage: quote.dayChangePercentage,
        timestamp: new Date(),
      });
    }
  }

  private validateSubscription(data: unknown): SubscriptionPayload {
    if (!data || typeof data !== 'object') {
      throw new WsException('Payload de suscripción inválido.');
    }

    const { topic, type } = data as Record<string, unknown>;
    const normalizedTopic =
      typeof topic === 'string' ? topic.trim().toUpperCase() : '';
    if (
      !/^[A-Z0-9.-]{1,20}$/.test(normalizedTopic) ||
      (type !== undefined && type !== 'stock' && type !== 'forex')
    ) {
      throw new WsException('Payload de suscripción inválido.');
    }

    return { topic: normalizedTopic, type };
  }
}
