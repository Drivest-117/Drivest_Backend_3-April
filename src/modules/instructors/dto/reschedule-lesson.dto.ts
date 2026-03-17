import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RescheduleLessonDto {
  @IsUUID()
  availabilitySlotId: string;

  @IsOptional()
  @IsBoolean()
  emergency?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
