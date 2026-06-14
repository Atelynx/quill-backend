import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';
import { RealtimeGateway } from './realtime.gateway';

interface GatewayInternals {
  server: Server;
  logger: Logger;
}

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let internals: GatewayInternals;
  let jwtService: { verifyAsync: jest.Mock };
  const serverTo = jest.fn().mockReturnThis();
  const serverEmit = jest.fn();

  const mockServer = {
    to: serverTo,
    emit: serverEmit,
  } as unknown as Server;

  beforeEach(async () => {
    serverTo.mockClear();
    serverEmit.mockClear();
    jwtService = { verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    internals = gateway as unknown as GatewayInternals;
    internals.server = mockServer;
  });

  describe('handleConnection', () => {
    let socket: Partial<Socket>;
    let socketData: Record<string, unknown>;

    beforeEach(() => {
      socketData = {};
      socket = {
        handshake: { auth: {}, query: {} } as never,
        data: socketData,
        disconnect: jest.fn(),
        join: jest.fn(),
        id: 'socket-1',
      };
    });

    it('disconnects when no token provided', async () => {
      await gateway.handleConnection(socket as Socket);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects on invalid JWT', async () => {
      if (socket.handshake) {
        socket.handshake.auth = { token: 'bad-token' };
      }
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await gateway.handleConnection(socket as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('bad-token');
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('authenticates and joins user room on valid token', async () => {
      if (socket.handshake) {
        socket.handshake.auth = { token: 'valid-token' };
      }
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-123' });

      await gateway.handleConnection(socket as Socket);

      expect(socketData.user).toEqual({ sub: 'user-123' });
      expect(socket.join).toHaveBeenCalledWith('user:user-123');
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('reads token from query if not in auth', async () => {
      if (socket.handshake) {
        socket.handshake.query = { token: 'query-token' };
      }
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-456' });

      await gateway.handleConnection(socket as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('query-token');
      expect(socket.join).toHaveBeenCalledWith('user:user-456');
    });
  });

  describe('handleDisconnect', () => {
    it('logs the disconnect', () => {
      const logSpy = jest.spyOn(internals.logger, 'log');
      const socket = { id: 'socket-1' } as Socket;

      gateway.handleDisconnect(socket);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('socket-1'));
    });
  });

  describe('handleSubscribe', () => {
    it('joins stock room by default', () => {
      const join = jest.fn();
      const client = { join, id: 'client-1' } as unknown as Socket;

      gateway.handleSubscribe(client, { topic: 'aapl' });

      expect(join).toHaveBeenCalledWith('stock:AAPL');
    });

    it('joins forex room when type is forex', () => {
      const join = jest.fn();
      const client = { join, id: 'client-1' } as unknown as Socket;

      gateway.handleSubscribe(client, { topic: 'EURUSD', type: 'forex' });

      expect(join).toHaveBeenCalledWith('forex:EURUSD');
    });

    it('rechaza payloads de suscripcion invalidos', () => {
      const join = jest.fn();
      const client = { join, id: 'client-1' } as unknown as Socket;

      expect(() =>
        gateway.handleSubscribe(client, { topic: '../admin' }),
      ).toThrow(WsException);
      expect(join).not.toHaveBeenCalled();
    });
  });

  describe('handleUnsubscribe', () => {
    it('leaves stock room by default', () => {
      const leave = jest.fn();
      const client = { leave, id: 'client-1' } as unknown as Socket;

      gateway.handleUnsubscribe(client, { topic: 'AAPL' });

      expect(leave).toHaveBeenCalledWith('stock:AAPL');
    });

    it('leaves forex room when type is forex', () => {
      const leave = jest.fn();
      const client = { leave, id: 'client-1' } as unknown as Socket;

      gateway.handleUnsubscribe(client, { topic: 'EURUSD', type: 'forex' });

      expect(leave).toHaveBeenCalledWith('forex:EURUSD');
    });
  });

  describe('handlePriceUpdate', () => {
    it('broadcasts price updates to stock rooms', () => {
      const quotes = [
        { symbol: 'AAPL', close: 150, dayChangePercentage: 5 },
        { symbol: 'GOOGL', close: 2800, dayChangePercentage: 2.5 },
      ];

      gateway.handlePriceUpdate(quotes);

      expect(serverTo).toHaveBeenCalledWith('stock:AAPL');
      expect(serverTo).toHaveBeenCalledWith('stock:GOOGL');
      expect(serverEmit).toHaveBeenCalledTimes(2);
      const emitCalls = serverEmit.mock.calls as unknown as Array<
        [string, { symbol: string; price: number; timestamp: unknown }]
      >;
      expect(emitCalls[0][0]).toBe('price_update');
      expect(emitCalls[0][1]).toMatchObject({ symbol: 'AAPL', price: 150 });
      expect(emitCalls[0][1].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('handleCurrencyUpdate', () => {
    it('broadcasts currency updates to forex rooms', () => {
      const quotes = [
        { symbol: 'EURUSD', close: 1.12, dayChangePercentage: 0.5 },
      ];

      gateway.handleCurrencyUpdate(quotes);

      expect(serverTo).toHaveBeenCalledWith('forex:EURUSD');
      const emitCalls = serverEmit.mock.calls as unknown as Array<
        [string, { symbol: string; price: number; timestamp: unknown }]
      >;
      expect(emitCalls[0][0]).toBe('price_update');
      expect(emitCalls[0][1]).toMatchObject({ symbol: 'EURUSD', price: 1.12 });
      expect(emitCalls[0][1].timestamp).toBeInstanceOf(Date);
    });
  });
});
