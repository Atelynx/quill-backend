import { SEED_CONFIG, SEED_KEY } from "./seed.type";

export const CURRENCY_SIMULATION_STRATEGY_KEY: SEED_KEY = {
    key: 'CURRENCY_SIMULATION_STRATEGY',
    defaultValue: 'flat',
    name: 'Estrategia de simulación de monedas',
    tags: ['currency', 'simulation'],
};

export const CURRENCY_PROVIDER_KEY: SEED_KEY = {
    key: 'CURRENCY_PROVIDER',
    defaultValue: 'mock',
    name: 'Proveedor de datos de monedas',
    tags: ['currency', 'provider'],
};

export const CURRENCY_SEED_CONFIG  : SEED_CONFIG= {
    name: "CURRENCY_SEED_CONFIG",
    keys: [
        CURRENCY_SIMULATION_STRATEGY_KEY,
        CURRENCY_PROVIDER_KEY,

    ]
}