import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StockDocument = HydratedDocument<Stock>;

@Schema({ collection: 'stocks', timestamps: true })
export class Stock {
  @Prop({ required: true, unique: true, uppercase: true })
  symbol!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, default: 'USD' })
  currency!: string;

  @Prop({ required: true })
  currentPrice!: number;

  @Prop({ required: true })
  previousClose!: number;

  @Prop({ required: true, default: 0 })
  dayChangePercentage!: number;

  @Prop({ default: 'mock' })
  source?: string;

  @Prop()
  volume?: number;

  @Prop()
  lastMarketDate?: Date;
}

export const StockSchema = SchemaFactory.createForClass(Stock);
