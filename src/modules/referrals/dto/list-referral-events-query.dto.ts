import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import {
  ReferralEventState,
  ReferralType,
} from "../../../entities/referral-event.entity";

export class ListReferralEventsQueryDto {
  @IsOptional()
  @IsEnum(ReferralType)
  referralType?: ReferralType;

  @IsOptional()
  @IsEnum(ReferralEventState)
  state?: ReferralEventState;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  referrerId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
