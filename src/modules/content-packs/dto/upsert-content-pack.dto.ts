import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertContentPackDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  platform: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  module: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  kind: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  language: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  version: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  hash?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsString()
  @IsNotEmpty()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    require_host: true,
  })
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  minAppVersion?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
