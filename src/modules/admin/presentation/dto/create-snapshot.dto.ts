import { IsOptional, IsString } from 'class-validator';

export class CreateSnapshotDto {
  @IsOptional()
  @IsString()
  name?: string;
}
