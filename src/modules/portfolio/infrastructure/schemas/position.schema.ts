import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PositionDocument = HydratedDocument<Position>;

@Schema({ collection: 'positions', timestamps: true })
export class Position {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, uppercase: true })
  symbol!: string;

  @Prop({ required: true, default: 0 })
  quantity!: number;

  @Prop({ required: true, default: 0 })
  reservedQuantity!: number;

  @Prop({ required: true, default: 0 })
  averageCost!: number;
}

export const PositionSchema = SchemaFactory.createForClass(Position);
PositionSchema.index({ userId: 1, symbol: 1 }, { unique: true });
