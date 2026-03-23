import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class LessonPickupDto {
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  postcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @IsString()
  placeId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;
}

export class CreateLessonDto {
  @IsUUID()
  instructorId: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsUUID()
  availabilitySlotId?: string;

  @IsOptional()
  @IsString()
  learnerNote?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LessonPickupDto)
  pickup?: LessonPickupDto;
}
