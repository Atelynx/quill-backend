import { IsNumber, IsOptional, IsPositive, IsString, MinLength, Matches } from 'class-validator';

export class CreateStockDto {
  @IsString()
  @Matches(/^[A-Za-z0-9.]+$/, { message: 'symbol must contain only letters, numbers, and dots' })
  symbol!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsPositive()
  close!: number;

  @IsNumber()
  @IsOptional()
  baseVolatility?: number;

  @IsNumber()
  @IsOptional()
  baseDrift?: number;
}
