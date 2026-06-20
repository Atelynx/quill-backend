import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FriendshipDocument = HydratedDocument<Friendship>;

@Schema({ collection: 'friendships', timestamps: true })
export class Friendship {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  friendId!: Types.ObjectId;

  @Prop({ required: true, enum: ['pending', 'accepted'] })
  status!: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const FriendshipSchema = SchemaFactory.createForClass(Friendship);

FriendshipSchema.index({ userId: 1, friendId: 1 }, { unique: true });
FriendshipSchema.index({ friendId: 1, status: 1, createdAt: -1 });
FriendshipSchema.index({ userId: 1, status: 1 });
FriendshipSchema.index({ friendId: 1, status: 1 });

// La unicidad entre ambas direcciones requiere migrar a un modelo simétrico.
