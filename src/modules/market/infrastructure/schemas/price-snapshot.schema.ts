import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PriceSnapshotDocument = HydratedDocument<PriceSnapshot>;

@Schema({
  collection: 'price_snapshots',
  timestamps: { createdAt: true, updatedAt: false },
})
export class PriceSnapshot {
  @Prop({ required: true, uppercase: true })
  symbol!: string;

  @Prop({ required: true })
  price!: number;

  createdAt!: Date;
}

export const PriceSnapshotSchema = SchemaFactory.createForClass(PriceSnapshot);
PriceSnapshotSchema.index({ symbol: 1, createdAt: -1 });
