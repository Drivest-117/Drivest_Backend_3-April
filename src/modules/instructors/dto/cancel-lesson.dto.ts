import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelLessonDto {
  @IsOptional()
  @IsBoolean()
  emergency?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
