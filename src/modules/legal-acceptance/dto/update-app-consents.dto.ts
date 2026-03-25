import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAppConsentsDto {
  @IsOptional()
  @IsIn(['allow', 'skip'])
  analyticsChoice?: 'allow' | 'skip';

  @IsOptional()
  @IsIn(['enable', 'skip'])
  notificationsChoice?: 'enable' | 'skip';

  @IsOptional()
  @IsIn(['allow', 'deny', 'skip'])
  locationChoice?: 'allow' | 'deny' | 'skip';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceSurface?: string;
}

