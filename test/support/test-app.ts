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
  Object.assign(process.env, {
    MONGOMS_MD5_CHECK: 'false',
    BACKEND_PORT: '3000',
    FRONTEND_ORIGIN: 'http://localhost:5173',
    MONGODB_URI: mongoUri,
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'quill-test-secret-12345',
    JWT_EXPIRES_IN: '1d',
    INITIAL_BALANCE: '100000',
    COMMISSION_RATE: '0.005',
    MARKET_PROVIDER: options.marketProvider ?? 'mock',
    MARKET_FETCH_ON_STARTUP: 'false',
    MARKET_TICK_INTERVAL_SECONDS: '0',
    SIMULATION_STRATEGY: 'flat',
    EODHD_API_KEY: 'test-eodhd-token',
    EODHD_SYMBOLS:
      'BSANTANDER.SN,CENCOSUD.SN,CHILE.SN,CMPC.SN,COLBUN.SN,COPEC.SN,SQM-B.SN,VAPORES.SN',
    EODHD_DAILY_REFRESH_ENABLED: 'false',
    CURRENCY_PROVIDER: 'mock',
    CURRENCY_SIMULATION_STRATEGY: 'flat',
    CURRENCY_RT_TICK_INTERVAL_SECONDS: '0',
    MOCK_CURRENCY_SYMBOLS: 'USDCLP',
    CURRENCY_SUFFIX_MAP: '.SN=CLP,.US=USD',
  });
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
  const origins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
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
