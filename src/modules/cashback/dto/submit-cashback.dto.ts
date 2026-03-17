import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TrackSummary {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(86_400)
  durationS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2_000_000)
  distanceM?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(300)
  avgSpeedKph?: number;

  @IsOptional()
  points?: Array<{ lat: number; lng: number; t?: number }>;
}

export class SubmitCashbackDto {
  @ValidateNested()
  @Type(() => TrackSummary)
  trackSummary: TrackSummary;

  @IsOptional()
  @IsUUID()
  centreId?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsString()
  pointsS3Key?: string;

  @IsOptional()
  @IsString()
  gpx?: string;

  @IsOptional()
  @IsDateString()
  testDateTime?: string;
}
