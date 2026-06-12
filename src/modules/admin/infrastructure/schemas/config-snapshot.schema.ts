import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ConfigSnapshotDocument = HydratedDocument<ConfigSnapshot>;

@Schema({ collection: 'admin_config_snapshots', timestamps: true })
export class ConfigSnapshot {
  @Prop({ required: true, type: SchemaTypes.Mixed })
  configs!: Record<string, any>;

  @Prop()
  name?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const ConfigSnapshotSchema =
  SchemaFactory.createForClass(ConfigSnapshot);
