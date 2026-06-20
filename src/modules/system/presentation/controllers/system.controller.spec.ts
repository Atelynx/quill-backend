import { ServiceUnavailableException } from '@nestjs/common';
import { SystemController } from './system.controller';

describe('SystemController', () => {
  it('responde readiness cuando mongodb esta disponible', () => {
    const readiness = {
      status: 'degraded',
      ready: true,
      services: { mongodb: 'up', redis: 'fallback' },
      timestamp: new Date().toISOString(),
    };
    const controller = new SystemController({
      getReadiness: jest.fn().mockReturnValue(readiness),
    } as never);

    expect(controller.getReadiness()).toBe(readiness);
  });

  it('responde HTTP 503 cuando mongodb no esta disponible', () => {
    const readiness = {
      status: 'error',
      ready: false,
      services: { mongodb: 'down', redis: 'fallback' },
      timestamp: new Date().toISOString(),
    };
    const controller = new SystemController({
      getReadiness: jest.fn().mockReturnValue(readiness),
    } as never);

    expect(() => controller.getReadiness()).toThrow(
      ServiceUnavailableException,
    );

    try {
      controller.getReadiness();
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    }
  });

  it('responde HTTP 503 cuando Redis requerido no esta disponible', () => {
    const controller = new SystemController({
      getReadiness: jest.fn().mockReturnValue({
        status: 'error',
        ready: false,
        services: { mongodb: 'up', redis: 'fallback' },
        timestamp: new Date().toISOString(),
      }),
    } as never);

    expect(() => controller.getReadiness()).toThrow(
      ServiceUnavailableException,
    );
  });
});
