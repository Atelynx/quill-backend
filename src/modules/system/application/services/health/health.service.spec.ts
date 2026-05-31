import { ConnectionStates } from 'mongoose';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('informa mongodb y redis como disponibles', () => {
    const service = new HealthService(
      {
        readyState: ConnectionStates.connected,
      } as never,
      {
        isConnected: jest.fn().mockReturnValue(true),
      } as never,
    );

    const result = service.getStatus();

    expect(result.status).toBe('ok');
    expect(result.services).toEqual({
      mongodb: 'up',
      redis: 'up',
    });
    expect(result.timestamp).toEqual(expect.any(String));
  });

  it('marca redis en fallback y mongodb abajo cuando no estan disponibles', () => {
    const service = new HealthService(
      {
        readyState: ConnectionStates.disconnected,
      } as never,
      {
        isConnected: jest.fn().mockReturnValue(false),
      } as never,
    );

    expect(service.getStatus()).toMatchObject({
      status: 'ok',
      services: {
        mongodb: 'down',
        redis: 'fallback',
      },
    });
  });
});
