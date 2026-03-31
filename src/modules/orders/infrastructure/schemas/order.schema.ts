import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ collection: 'orders', timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, uppercase: true })
  symbol!: string;

  @Prop({ required: true, enum: ['BUY', 'SELL'] })
  side!: 'BUY' | 'SELL';

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  limitPrice!: number;

  @Prop({
    required: true,
    enum: ['PENDING', 'EXECUTED', 'CANCELLED'],
    default: 'PENDING',
  })
  status!: 'PENDING' | 'EXECUTED' | 'CANCELLED';

  @Prop({ required: true, default: 0 })
  reservedAmount!: number;

  @Prop({ required: false })
  executionPrice?: number;

  @Prop({ required: false, default: 0 })
  commissionAmount?: number;

  @Prop({ required: false })
  executedAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, symbol: 1 });
