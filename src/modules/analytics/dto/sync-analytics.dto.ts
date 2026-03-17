import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const ANALYTICS_MODULE_KEYS = [
  'theory',
  'highway_code',
  'know_your_signs',
  'fines_penalties',
  'practice',
  'navigation',
] as const;

export type AnalyticsModuleKey = (typeof ANALYTICS_MODULE_KEYS)[number];

export class ModuleProgressUpsertDto {
  @IsString()
  moduleKey: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  completionPercent?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bookmarks?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wrongQueue?: string[];

  @IsOptional()
  @IsISO8601()
  lastActivityAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ModulePassStatusUpsertDto {
  @IsString()
  moduleKey: string;

  @IsBoolean()
  passed: boolean;

  @IsOptional()
  @IsISO8601()
  passedAt?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ModuleRollupUpsertDto {
  @IsString()
  moduleKey: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quizzesCompleted?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  questionsAnswered?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  correctAnswers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bestScorePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  lastScorePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  practiceStarted?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  practiceCompleted?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  navigationStarted?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  navigationCompleted?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  completedRouteIds?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SyncAnalyticsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleProgressUpsertDto)
  moduleProgress?: ModuleProgressUpsertDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModulePassStatusUpsertDto)
  modulePassStatuses?: ModulePassStatusUpsertDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleRollupUpsertDto)
  moduleRollups?: ModuleRollupUpsertDto[];
}
