import { IsBoolean, IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AdminFinanceRepairDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
