export interface StockEntity {
  symbol: string;
  name: string;
  sector: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  dayChangePercentage: number;
}
