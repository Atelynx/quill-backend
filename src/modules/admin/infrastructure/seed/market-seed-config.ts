import { SEED_CONFIG, SEED_KEY } from './seed.type';
export const SIMULATION_STRATEGY_KEY: SEED_KEY = {
  key: 'SIMULATION_STRATEGY',
  defaultValue: 'flat',
  name: 'Estrategia de simulación',
  tags: ['market', 'simulation'],
};
export const MARKET_PROVIDER_KEY: SEED_KEY = {
  key: 'MARKET_PROVIDER',
  defaultValue: 'mock',
  name: 'Proveedor de datos de mercado',
  tags: ['market', 'provider'],
};
export const MARKET_FETCH_ON_STARTUP_KEY: SEED_KEY = {
  key: 'MARKET_FETCH_ON_STARTUP',
  defaultValue: 'false',
  name: 'Solicitar datos al iniciar',
  tags: ['market', 'provider'],
};
export const MARKET_TICK_INTERVAL_SECONDS_KEY: SEED_KEY = {
  key: 'MARKET_TICK_INTERVAL_SECONDS',
  defaultValue: '5',
  name: 'Intervalo de Simulacion de stocks',
  tags: ['market', 'provider'],
};
export const COMMISSION_RATE_KEY: SEED_KEY = {
  key: 'COMMISSION_RATE',
  defaultValue: 0.005,
  name: 'Comisión de trading',
  tags: ['market', 'fees'],
};

export const INITIAL_BALANCE_KEY: SEED_KEY = {
  key: 'INITIAL_BALANCE',
  defaultValue: 100000,
  name: 'Balance inicial',
  tags: ['market', 'users', 'registration'],
};

export const MARKET_HOURS_OPEN_KEY: SEED_KEY = {
  key: 'MARKET_HOURS_OPEN',
  defaultValue: '09:30',
  name: 'Horario apertura mercado',
  tags: ['market', 'hours'],
};

export const MARKET_HOURS_CLOSED_KEY: SEED_KEY = {
  key: 'MARKET_HOURS_CLOSED',
  defaultValue: '16:00',
  name: 'Horario cierre mercado',
  tags: ['market', 'hours'],
};

export const MARKET_SEED_CONFIG: SEED_CONFIG = {
  name: 'MARKET_SEED_CONFIG',
  keys: [
    SIMULATION_STRATEGY_KEY,
    MARKET_PROVIDER_KEY,
    COMMISSION_RATE_KEY,
    INITIAL_BALANCE_KEY,
    MARKET_HOURS_OPEN_KEY,
    MARKET_HOURS_CLOSED_KEY,
  ],
};
