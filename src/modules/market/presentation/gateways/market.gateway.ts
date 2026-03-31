import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MarketGateway {
  @WebSocketServer()
  private server!: Server;

  emitQuotes(quotes: unknown): void {
    this.server.emit('market.quotes', quotes);
  }
}
