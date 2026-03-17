import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DisputeStatus } from '../entities/dispute-case.entity';

const adminUpdatableStatuses: DisputeStatus[] = [
  'triage',
  'awaiting_evidence',
  'resolved',
  'closed',
];

export class UpdateDisputeStatusDto {
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsIn(adminUpdatableStatuses)
  status: DisputeStatus;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim(),
  )
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsDateString()
  resolutionTargetBy?: string;
}
