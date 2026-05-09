export interface StockEntity {
  symbol: string;
  name: string;
  sector: string;
  currency: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose: number;
  dayChangePercentage: number;
}
