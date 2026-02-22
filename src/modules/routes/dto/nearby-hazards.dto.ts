import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class NearbyCenterDto {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;
}

export class NearbyHazardsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lon: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => NearbyCenterDto)
  center?: NearbyCenterDto;

  @IsOptional()
  @IsString()
  centreId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsString()
  @IsIn(['PREVIEW', 'TO_START', 'ON_ROUTE', 'OFF_ROUTE'])
  mode?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(1200)
  radiusM?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(500)
  routeCorridorM?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  types?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return value;
  })
  @IsBoolean()
  aheadOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(10000)
  aheadDistanceM?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  backtrackToleranceM?: number;
}
