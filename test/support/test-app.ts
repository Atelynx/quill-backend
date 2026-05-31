import { ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { CacheService } from '../../src/modules/system/application/services/cache/cache.service';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

export interface TestAppContext {
  app: INestApplication;
  connection: Connection;
  mongoServer: MongoMemoryReplSet;
}

interface TestAppOptions {
  marketProvider?: 'mock' | 'eodhd';
}

function applyTestEnvironment(mongoUri: string, options: TestAppOptions = {}) {
  process.env.MONGOMS_MD5_CHECK = 'false';
  process.env.BACKEND_PORT = '3000';
  process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
  process.env.MONGODB_URI = mongoUri;
  process.env.REDIS_URL = 'redis://127.0.0.1:6399';
  process.env.JWT_SECRET = 'quill-test-secret-12345';
  process.env.JWT_EXPIRES_IN = '1d';
  process.env.INITIAL_BALANCE = '100000';
  process.env.COMMISSION_RATE = '0.005';
  process.env.MARKET_PROVIDER = options.marketProvider ?? 'mock';
  process.env.MARKET_TICK_INTERVAL_SECONDS = '3600';
  process.env.EODHD_API_KEY = 'test-eodhd-token';
  process.env.EODHD_SYMBOLS = 'BSANTANDER.SN,CENCOSUD.SN,CHILE.SN,CMPC.SN,COLBUN.SN,COPEC.SN,SQM-B.SN,VAPORES.SN';
  process.env.EODHD_DAILY_REFRESH_ENABLED = 'false';
}

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestAppContext> {
  process.env.MONGOMS_MD5_CHECK = 'false';
  const mongoServer = await MongoMemoryReplSet.create({
    binary: {
      version: '7.0.14',
      checkMD5: false,
    },
    replSet: {
      count: 1,
      storageEngine: 'wiredTiger',
    },
  });
  await mongoServer.waitUntilRunning();

  applyTestEnvironment(mongoServer.getUri(), options);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const importedModule = require('../../src/app.module') as {
    AppModule: never;
  };
  const moduleRef = await Test.createTestingModule({
    imports: [importedModule.AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

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
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: true,
  });
  app.setGlobalPrefix('api');

  await app.init();

  return {
    app,
    connection: app.get<Connection>(getConnectionToken()),
    mongoServer,
  };
}

export async function destroyTestApp({
  app,
  mongoServer,
}: TestAppContext): Promise<void> {
  const cacheService = app.get(CacheService);
  cacheService.onModuleDestroy = () => Promise.resolve();
  await app.close();
  await mongoServer.stop();
}
