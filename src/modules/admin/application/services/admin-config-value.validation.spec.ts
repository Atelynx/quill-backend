import { BadRequestException } from '@nestjs/common';
import { validateAdminConfigValue } from './admin-config-value.validation';

describe('validateAdminConfigValue', () => {
  it.each([
    ['COMMISSION_RATE', 0.005],
    ['INITIAL_BALANCE', 100000],
    ['MARKET_HOURS_OPEN', '09:30'],
    ['MARKET_PROVIDER', 'mock'],
    ['SIMULATION_STRATEGY', 'gbm'],
    ['MARKET_CLOSED_DAYS', '6,7'],
    ['MARKET_CLOSED_DAYS', '1,2,3,4,5'],
  ])('acepta %s con un valor permitido', (key, value) => {
    expect(() => validateAdminConfigValue(key, value)).not.toThrow();
  });

  it.each([
    ['COMMISSION_RATE', -0.1],
    ['COMMISSION_RATE', 1.1],
    ['INITIAL_BALANCE', 0],
    ['MARKET_HOURS_CLOSED', '25:99'],
    ['MARKET_PROVIDER', 'unknown'],
    ['SIMULATION_STRATEGY', 'random'],
    ['MARKET_CLOSED_DAYS', '0,7'],
    ['MARKET_CLOSED_DAYS', '8'],
    ['MARKET_CLOSED_DAYS', 'abc'],
    ['MARKET_CLOSED_DAYS', ''],
  ])('rechaza %s con un valor imposible', (key, value) => {
    expect(() => validateAdminConfigValue(key, value)).toThrow(
      BadRequestException,
    );
  });
});
