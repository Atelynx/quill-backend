export interface PriceUpdatePayload {
  symbol: string;
  close: number;
  dayChangePercentage?: number;
}

export interface PriceUpdateEvent {
  quotes: PriceUpdatePayload[];
}
