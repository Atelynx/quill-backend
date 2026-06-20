import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AdminConfigDocument = HydratedDocument<AdminConfig>;

@Schema({ collection: 'admin_configs', timestamps: true })
export class AdminConfig {
  @Prop({ required: true })
  key!: string;

  @Prop({ required: true, type: SchemaTypes.Mixed })
  value!: unknown;

  @Prop()
  name?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ type: Boolean, default: true })
  inUse!: boolean;

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  createdAt?: Date;

  updatedAt?: Date;
}

const schema = SchemaFactory.createForClass(AdminConfig);

schema.index(
  { key: 1 },
  { unique: true, partialFilterExpression: { inUse: true } },
);
schema.index({ key: 1, createdAt: -1 });

export const AdminConfigSchema = schema;
