import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const baseEnv = {
    MONGODB_URI: 'mongodb://localhost:27017/quill',
    JWT_SECRET: 'quill-test-secret-12345',
  };

  it('acepta MARKET_PROVIDER=mock sin API key EODHD', () => {
    const result = envValidationSchema.validate({
      ...baseEnv,
      MARKET_PROVIDER: 'mock',
    });

    expect(result.error).toBeUndefined();
  });

  it('acepta MARKET_PROVIDER=eodhd con API key', () => {
    const result = envValidationSchema.validate({
      ...baseEnv,
      MARKET_PROVIDER: 'eodhd',
      EODHD_API_KEY: 'test-token',
    });

    expect(result.error).toBeUndefined();
  });

  it('rechaza MARKET_PROVIDER=eodhd sin API key', () => {
    const result = envValidationSchema.validate({
      ...baseEnv,
      MARKET_PROVIDER: 'eodhd',
    });

    expect(result.error?.message).toContain('EODHD_API_KEY');
  });
});
