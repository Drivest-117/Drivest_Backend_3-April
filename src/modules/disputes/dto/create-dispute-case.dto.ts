import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  DisputeCategory,
  DisputePartyRole,
  DisputePriority,
} from '../entities/dispute-case.entity';

const disputeCategories: DisputeCategory[] = ['booking', 'payment', 'safety', 'conduct', 'other'];
const disputePriorities: DisputePriority[] = ['low', 'normal', 'high', 'urgent'];
const disputePartyRoles: DisputePartyRole[] = ['learner', 'instructor', 'admin'];

export class CreateDisputeCaseDto {
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim().toLowerCase(),
  )
  @IsIn(disputeCategories)
  category?: DisputeCategory;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim().toLowerCase(),
  )
  @IsIn(disputePriorities)
  priority?: DisputePriority;

  @IsOptional()
  @IsUUID()
  againstUserId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim().toLowerCase(),
  )
  @IsIn(disputePartyRoles)
  againstRole?: DisputePartyRole;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim(),
  )
  @IsString()
  @MaxLength(1000)
  initialNote?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(512, { each: true })
  evidenceLinks?: string[];
}
