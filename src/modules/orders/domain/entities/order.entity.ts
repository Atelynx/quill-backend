export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED';

export interface OrderEntity {
  userId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  limitPrice: number;
  status: OrderStatus;
  reservedAmount: number;
}
