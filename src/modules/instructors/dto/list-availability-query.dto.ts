import { IsOptional, Matches } from 'class-validator';

export class ListAvailabilityQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;
}
