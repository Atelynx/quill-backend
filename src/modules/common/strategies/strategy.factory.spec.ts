import { FlatMarketSimulationStrategy } from "./flat-market-simulation.strategy";
import { GBMMarketSimulationStrategy } from "./gbm-market-simulation.strategy";
import { NoiseWaveSimulationStrategy } from "./nw-simulation.strategy";
import { StrategyFactory } from "./strategy.factory";
import { StrategyType } from "./strategy.types";

describe("Strategy Factory", () => {
    let strategyName: StrategyType | undefined;
    let gbm: GBMMarketSimulationStrategy;
    let flat: FlatMarketSimulationStrategy;
    let noiseWave: NoiseWaveSimulationStrategy;

    beforeEach(() => {
        strategyName = undefined
        gbm = {
            boxMuller: jest.fn(),
            calculateNextTick: jest.fn()

        } as unknown as GBMMarketSimulationStrategy

        flat = {
            calculateNextTick: jest.fn()
        } as unknown as FlatMarketSimulationStrategy

        noiseWave = {
            calculateNextTick: jest.fn()
        } as unknown as NoiseWaveSimulationStrategy





    })
    it("should return flat", () => {

        strategyName = "flat";
        flat = new FlatMarketSimulationStrategy();
        expect(StrategyFactory.createStrategy(strategyName, gbm, flat, noiseWave)).toBeInstanceOf(FlatMarketSimulationStrategy);
        expect(StrategyFactory.createStrategy(strategyName, gbm, flat, noiseWave)).toBe(flat);
    })
    it("should return gbm", () => {

        strategyName = "gbm";
        gbm = new GBMMarketSimulationStrategy();
        expect(StrategyFactory.createStrategy(strategyName, gbm, flat, noiseWave)).toBeInstanceOf(GBMMarketSimulationStrategy);
        expect(StrategyFactory.createStrategy(strategyName, gbm, flat, noiseWave)).toBe(gbm);
    })
    it("should return noise wave", () => {

        strategyName = "nw";
        noiseWave = new NoiseWaveSimulationStrategy();
        expect(StrategyFactory.createStrategy(strategyName, gbm, flat, noiseWave)).toBeInstanceOf(NoiseWaveSimulationStrategy);
        expect(StrategyFactory.createStrategy(strategyName, gbm, flat, noiseWave)).toBe(noiseWave);
    })
    it("should return invalid option", () => {

        strategyName = "INVALID" as StrategyType;

        expect(() => StrategyFactory.createStrategy(strategyName, gbm, flat, noiseWave)).toThrow(Error);
    })







})