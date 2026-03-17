import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DisputeStatus } from '../entities/dispute-case.entity';

const disputeStatuses: DisputeStatus[] = [
  'opened',
  'triage',
  'awaiting_evidence',
  'resolved',
  'closed',
];

export class ListDisputeCasesQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim().toLowerCase(),
  )
  @IsIn(disputeStatuses)
  status?: DisputeStatus;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  overdueOnly?: boolean;
}
