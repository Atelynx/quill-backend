import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertConfigDto {
  @IsNotEmpty()
  value!: any;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
