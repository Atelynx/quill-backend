import { IsNumber, IsPositive } from 'class-validator';

export class UpdateStockPriceDto {
  @IsNumber()
  @IsPositive()
  price!: number;
}
