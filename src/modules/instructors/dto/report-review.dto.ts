import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReportReviewDto {
  @IsString()
  @MaxLength(64)
  reasonCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
