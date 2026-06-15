import { ConnectionStates } from 'mongoose';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('informa que el proceso esta vivo sin consultar dependencias', () => {
    const cacheService = {
      isConnected: jest.fn(),
    };
    const service = new HealthService(
      {} as never,
      cacheService as never,
      { get: jest.fn().mockReturnValue('test') } as never,
    );

    const result = service.getLiveness();

    expect(result.status).toBe('ok');
    expect(result.timestamp).toEqual(expect.any(String));
    expect(cacheService.isConnected).not.toHaveBeenCalled();
  });

  it('informa readiness exitoso con mongodb y redis disponibles', () => {
    const service = new HealthService(
      {
        readyState: ConnectionStates.connected,
      } as never,
      {
        isConnected: jest.fn().mockReturnValue(true),
      } as never,
      { get: jest.fn().mockReturnValue('production') } as never,
    );

    const result = service.getReadiness();

    expect(result.status).toBe('ok');
    expect(result.ready).toBe(true);
    expect(result.services).toEqual({
      mongodb: 'up',
      redis: 'up',
    });
    expect(result.timestamp).toEqual(expect.any(String));
  });

  it('informa readiness fallido cuando mongodb esta caido', () => {
    const service = new HealthService(
      {
        readyState: ConnectionStates.disconnected,
      } as never,
      {
        isConnected: jest.fn().mockReturnValue(false),
      } as never,
      { get: jest.fn().mockReturnValue('production') } as never,
    );

    expect(service.getReadiness()).toMatchObject({
      status: 'error',
      ready: false,
      services: {
        mongodb: 'down',
        redis: 'unavailable',
      },
    });
  });

  it('marca readiness fallido en produccion cuando redis usa fallback', () => {
    const service = new HealthService(
      { readyState: ConnectionStates.connected } as never,
      { isConnected: jest.fn().mockReturnValue(false) } as never,
      { get: jest.fn().mockReturnValue('production') } as never,
    );

    expect(service.getReadiness()).toMatchObject({
      status: 'error',
      ready: false,
      services: {
        mongodb: 'up',
        redis: 'unavailable',
      },
    });
  });

  it('mantiene readiness degradado en desarrollo cuando redis usa fallback', () => {
    const service = new HealthService(
      { readyState: ConnectionStates.connected } as never,
      { isConnected: jest.fn().mockReturnValue(false) } as never,
      { get: jest.fn().mockReturnValue('development') } as never,
    );

    expect(service.getReadiness()).toMatchObject({
      status: 'degraded',
      ready: true,
      services: {
        mongodb: 'up',
        redis: 'fallback',
      },
    });
  });
});
