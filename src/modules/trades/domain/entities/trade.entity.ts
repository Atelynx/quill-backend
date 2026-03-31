export interface TradeEntity {
  userId: string;
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  executionPrice: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  executedAt: Date;
}
