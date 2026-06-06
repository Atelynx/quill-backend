import { ArrayNotEmpty, IsString } from 'class-validator';

export class AddWatchlistDto {
  @ArrayNotEmpty()
  @IsString({ each: true })
  symbols!: string[];
}
