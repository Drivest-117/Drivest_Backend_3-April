import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MaxLength } from "class-validator";
import { ReferralEventState } from "../../../entities/referral-event.entity";

export class ReviewReferralEventDto {
  @IsEnum(ReferralEventState)
  targetState!: ReferralEventState;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  failureReason?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  fraudScore?: number;
}
