import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AddDisputeEvidenceDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(512, { each: true })
  links?: string[];
}
