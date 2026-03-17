import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GetContentManifestQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  module?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}
