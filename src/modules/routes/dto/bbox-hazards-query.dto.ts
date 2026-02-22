import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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

export class BboxHazardsQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  south!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  west!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  north!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  east!: number;

  @IsString()
  centreId!: string;

  @IsOptional()
  @Transform(toTypeArray)
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  types?: string[];
}
