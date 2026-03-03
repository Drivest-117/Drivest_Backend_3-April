import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateInstructorProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9]{6,16}$/)
  adiNumber?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  yearsExperience?: number;

  @IsOptional()
  @IsIn(['manual', 'automatic', 'both'])
  transmissionType?: 'manual' | 'automatic' | 'both';

  @IsOptional()
  @IsInt()
  @Min(0)
  hourlyRatePence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coveragePostcodes?: string[];

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  homeLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  homeLng?: number;
}
