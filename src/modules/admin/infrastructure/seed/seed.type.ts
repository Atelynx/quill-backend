import { CURRENCY_PROVIDER_KEY, CURRENCY_SEED_CONFIG, CURRENCY_SIMULATION_STRATEGY_KEY } from "./currency-seed.config";
import { MARKET_PROVIDER_KEY, MARKET_SEED_CONFIG, SIMULATION_STRATEGY_KEY } from "./market-seed-config";
 
export const RESTART_REQUIRED_KEYS = new Set([
    MARKET_PROVIDER_KEY.key,
    SIMULATION_STRATEGY_KEY.key,
    CURRENCY_PROVIDER_KEY.key,
    SIMULATION_STRATEGY_KEY.key,
    CURRENCY_SIMULATION_STRATEGY_KEY.key,

]);
export const SEED_CONFIGS =
[   
    ...CURRENCY_SEED_CONFIG.keys,
    ...MARKET_SEED_CONFIG.keys,
]

export type SEED_KEY = {
    key: string;
    defaultValue: string | number;
    name: string;
    tags: string[];
};

export type SEED_CONFIG = {
    name: string;
    keys: SEED_KEY[];
};