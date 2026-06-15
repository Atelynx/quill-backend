import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class CacheFallbackPolicy {
  private readonly allowed: boolean;
  private warningShown = false;

  constructor(configService: ConfigService) {
    this.allowed =
      configService.get<string>('NODE_ENV', 'development') !== 'production';
  }

  assertAllowed(): void {
    if (!this.allowed) {
      throw new ServiceUnavailableException(
        'Redis no está disponible y es requerido en producción.',
      );
    }
  }

  logUnavailable(logger: Logger, message: string): void {
    if (this.warningShown) return;
    this.warningShown = true;
    if (this.allowed) {
      logger.warn(`${message} Se usará cache local temporal.`);
      return;
    }
    logger.error(`${message} Cache compartida no disponible.`);
  }
}
