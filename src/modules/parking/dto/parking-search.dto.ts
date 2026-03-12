import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class ParkingSearchDto {
  @Type(() => Number)
  @IsNumber()
  min_lat: number;

  @Type(() => Number)
  @IsNumber()
  min_lon: number;

  @Type(() => Number)
  @IsNumber()
  max_lat: number;

  @Type(() => Number)
  @IsNumber()
  max_lon: number;

  @IsOptional()
  @IsISO8601()
  at?: string;

  @IsOptional()
  @IsIn(['all', 'free', 'paid', 'restricted', 'unknown'])
  fee?: 'all' | 'free' | 'paid' | 'restricted' | 'unknown';

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value === true || value === 'true' || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === '0') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  accessible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  center_lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  center_lon?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(120)
  limit?: number;
}
