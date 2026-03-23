import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AdminFinanceReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @IsOptional()
  @IsIn(['planned', 'requested', 'accepted', 'declined', 'completed', 'cancelled'])
  lessonStatus?: string;

  @IsOptional()
  @IsIn(['not_applicable', 'estimated', 'ready', 'disputed', 'voided'])
  commissionStatus?: string;

  @IsOptional()
  @IsIn(['not_applicable', 'pending', 'on_hold', 'ready_for_manual_payout', 'marked_paid', 'voided'])
  payoutStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
