import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    cors: false,
  });

  const configService = app.get(ConfigService);
  const frontendOrigin = configService.get<string>('FRONTEND_ORIGIN');
  const port = configService.get<number>('BACKEND_PORT', 3000);

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: frontendOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');

  await app.listen(port);
  logger.log(`Backend de Quill escuchando en http://localhost:${port}/api`);
  logger.log(
    `Origen permitido para frontend: ${frontendOrigin ?? 'no definido'}`,
  );
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  const message = error instanceof Error ? error.message : 'Error desconocido';
  logger.error(`No fue posible iniciar el backend: ${message}`);
  process.exit(1);
});
