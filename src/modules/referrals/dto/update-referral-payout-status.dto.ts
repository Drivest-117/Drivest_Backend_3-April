import { Transform } from "class-transformer";
import { IsBoolean } from "class-validator";

export class UpdateReferralPayoutStatusDto {
  @Transform(({ value }) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "true";
  })
  @IsBoolean()
  isPaid!: boolean;
}
