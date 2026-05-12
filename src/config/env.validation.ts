import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  BACKEND_PORT: Joi.number().default(3000),
  FRONTEND_ORIGIN: Joi.string().default('http://localhost:5173'),
  MONGODB_URI: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  INITIAL_BALANCE: Joi.number().positive().default(100000),
  COMMISSION_RATE: Joi.number().min(0).max(1).default(0.005),
  MARKET_PROVIDER: Joi.string().valid('mock', 'eodhd').optional(),
  MARKET_TICK_INTERVAL_SECONDS: Joi.number().min(5).default(15),
  EODHD_API_KEY: Joi.when('MARKET_PROVIDER', {
    is: 'eodhd',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  EODHD_BASE_URL: Joi.string().uri().default('https://eodhd.com/api'),
  EODHD_EXCHANGE_CODE: Joi.string().default('SN'),
  EODHD_SYMBOLS: Joi.string().default(
    'SQM-B.SN,VAPORES.SN,BSANTANDER.SN,COPEC.SN,CENCOSUD.SN,CHILE.SN,CMPC.SN,COLBUN.SN',
  ),
  MARKET_FETCH_ON_STARTUP: Joi.boolean().default(false),
  EODHD_DAILY_REFRESH_ENABLED: Joi.boolean().default(true),
  EODHD_DAILY_REFRESH_CRON: Joi.string().default('0 30 18 * * 1-5'),
  EODHD_CACHE_TTL_SECONDS: Joi.number().positive().default(86400),
});
