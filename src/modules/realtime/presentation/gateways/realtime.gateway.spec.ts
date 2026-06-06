import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: { verifyAsync: jest.Mock };

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as unknown as Server;

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    (gateway as any).server = mockServer;
  });

  describe('handleConnection', () => {
    let socket: Partial<Socket>;

    beforeEach(() => {
      socket = {
        handshake: { auth: {}, query: {} } as never,
        data: {},
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

      expect(socket.data.user).toEqual({ sub: 'user-123' });
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
      const logSpy = jest.spyOn((gateway as any).logger, 'log');
      const socket = { id: 'socket-1' } as Socket;

      gateway.handleDisconnect(socket);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('socket-1'));
    });
  });

  describe('handleSubscribe', () => {
    it('joins stock room by default', () => {
      const client = { join: jest.fn(), id: 'client-1' } as unknown as Socket;

      gateway.handleSubscribe(client, { topic: 'AAPL' });

      expect(client.join).toHaveBeenCalledWith('stock:AAPL');
    });

    it('joins forex room when type is forex', () => {
      const client = { join: jest.fn(), id: 'client-1' } as unknown as Socket;

      gateway.handleSubscribe(client, { topic: 'EURUSD', type: 'forex' });

      expect(client.join).toHaveBeenCalledWith('forex:EURUSD');
    });
  });

  describe('handleUnsubscribe', () => {
    it('leaves stock room by default', () => {
      const client = { leave: jest.fn(), id: 'client-1' } as unknown as Socket;

      gateway.handleUnsubscribe(client, { topic: 'AAPL' });

      expect(client.leave).toHaveBeenCalledWith('stock:AAPL');
    });

    it('leaves forex room when type is forex', () => {
      const client = { leave: jest.fn(), id: 'client-1' } as unknown as Socket;

      gateway.handleUnsubscribe(client, { topic: 'EURUSD', type: 'forex' });

      expect(client.leave).toHaveBeenCalledWith('forex:EURUSD');
    });
  });

  describe('handlePriceUpdate', () => {
    it('broadcasts price updates to stock rooms', () => {
      const quotes = [
        { symbol: 'AAPL', close: 150, dayChangePercentage: 5 },
        { symbol: 'GOOGL', close: 2800, dayChangePercentage: 2.5 },
      ];

      gateway.handlePriceUpdate(quotes);

      expect(mockServer.to).toHaveBeenCalledWith('stock:AAPL');
      expect(mockServer.to).toHaveBeenCalledWith('stock:GOOGL');
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
      expect(mockServer.emit).toHaveBeenCalledWith('price_update', {
        symbol: 'AAPL',
        price: 150,
        dayChangePercentage: 5,
        timestamp: expect.any(Date),
      });
    });
  });

  describe('handleCurrencyUpdate', () => {
    it('broadcasts currency updates to forex rooms', () => {
      const quotes = [
        { symbol: 'EURUSD', close: 1.12, dayChangePercentage: 0.5 },
      ];

      gateway.handleCurrencyUpdate(quotes);

      expect(mockServer.to).toHaveBeenCalledWith('forex:EURUSD');
      expect(mockServer.emit).toHaveBeenCalledWith('price_update', {
        symbol: 'EURUSD',
        price: 1.12,
        dayChangePercentage: 0.5,
        timestamp: expect.any(Date),
      });
    });
  });
});
