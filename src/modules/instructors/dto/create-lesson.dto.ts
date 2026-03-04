import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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
}
