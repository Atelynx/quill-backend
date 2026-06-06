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
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@Injectable()
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: '*' },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = socket.handshake.auth.token ?? socket.handshake.query.token;
    if (!token) {
      socket.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync(token);
      socket.data.user = payload;
      socket.join(`user:${payload.sub}`);
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    client: Socket,
    data: { topic: string; type?: 'stock' | 'forex' },
  ): void {
    const prefix = data.type === 'forex' ? 'forex' : 'stock';
    const room = `${prefix}:${data.topic}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} subscribed to ${room}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    client: Socket,
    data: { topic: string; type?: 'stock' | 'forex' },
  ): void {
    const prefix = data.type === 'forex' ? 'forex' : 'stock';
    const room = `${prefix}:${data.topic}`;
    client.leave(room);
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
}
