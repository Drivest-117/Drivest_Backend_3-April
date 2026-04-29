import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListReferralPayoutsQueryDto {
  @IsOptional()
  @IsUUID()
  referrerId?: string;

  @IsOptional()
  @IsUUID()
  refereeId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return undefined;
    return normalized === "true";
  })
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
