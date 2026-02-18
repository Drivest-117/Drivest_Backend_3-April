import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ROAD_HAZARD_TYPES } from '../road-hazard.service';

const toTypeArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toBool = ({ value }: { value: unknown }): boolean | undefined => {
  if (value == null || value === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
};

export class RouteHazardsQueryDto {
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  refresh?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(200)
  corridorWidthM?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(300)
  limit?: number;

  @IsOptional()
  @Transform(toTypeArray)
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(ROAD_HAZARD_TYPES, { each: true })
  types?: string[];
}
