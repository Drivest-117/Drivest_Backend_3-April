import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordAppLegalAcceptanceDto {
  @IsString()
  @MaxLength(64)
  termsVersion: string;

  @IsString()
  @MaxLength(64)
  privacyVersion: string;

  @IsString()
  @MaxLength(64)
  safetyVersion: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceScreen?: string;

  @IsOptional()
  @IsBoolean()
  ageConfirmed?: boolean;

  @IsOptional()
  @IsBoolean()
  safetyAccepted?: boolean;
}

