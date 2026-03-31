import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TradeDocument = HydratedDocument<Trade>;

@Schema({ collection: 'trades', timestamps: false })
export class Trade {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true, uppercase: true })
  symbol!: string;

  @Prop({ required: true, enum: ['BUY', 'SELL'] })
  side!: 'BUY' | 'SELL';

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  executionPrice!: number;

  @Prop({ required: true })
  grossAmount!: number;

  @Prop({ required: true })
  commissionAmount!: number;

  @Prop({ required: true })
  netAmount!: number;

  @Prop({ required: true })
  executedAt!: Date;
}

export const TradeSchema = SchemaFactory.createForClass(Trade);
TradeSchema.index({ userId: 1, executedAt: -1 });
