import { IsIn, IsString } from 'class-validator';

export class UpdateUserRoleDto {
  @IsString()
  @IsIn(['admin', 'investor'])
  role!: 'admin' | 'investor';
}
