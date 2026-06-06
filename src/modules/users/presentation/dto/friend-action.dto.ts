import { IsIn, IsString } from 'class-validator';

export class FriendActionDto {
  @IsString()
  @IsIn(['accepted'])
  status!: 'accepted';
}
