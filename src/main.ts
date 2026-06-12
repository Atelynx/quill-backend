import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    cors: false,
  });

  const configService = app.get(ConfigService);
  const rawOrigins = configService.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173');
  const origins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);
  const port = configService.get<number>('BACKEND_PORT', 3000);

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
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
  const apiPath = 'api';
  app.setGlobalPrefix(apiPath);
  // Swagger Options
  const options = new DocumentBuilder()
    .addBearerAuth()
    .setTitle('Quill Swagger API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  // Swagger path: http://localhost:3000/api/docs
  SwaggerModule.setup(`${apiPath}/swagger`, app, document);

  await app.listen(port);
  logger.log(`Backend de Quill escuchando en http://localhost:${port}/api`);
  logger.log(`Swaggeer de Quill en http://localhost:${port}/api/swagger`)
  logger.log(
    `Origen permitido para frontend: ${rawOrigins ?? 'no definido'}`,
  );
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  const message = error instanceof Error ? error.message : 'Error desconocido';
  logger.error(`No fue posible iniciar el backend: ${message}`);
  process.exit(1);
});
