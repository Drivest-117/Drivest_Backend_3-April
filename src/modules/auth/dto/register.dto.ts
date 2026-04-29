import { Transform } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @Transform(({ value }) =>
    String(value ?? "")
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
  password: string;

  @IsOptional()
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsIn(["USER", "INSTRUCTOR"])
  role?: "USER" | "INSTRUCTOR";

  @IsOptional()
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @IsUUID()
  referredById?: string;

  @IsOptional()
  @Transform(({ value }) =>
    String(value ?? "")
      .trim()
      .toUpperCase(),
  )
  @IsIn(["I2L", "I2I", "L2L", "L2I"])
  referralType?: "I2L" | "I2I" | "L2L" | "L2I";

  @IsOptional()
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @MaxLength(255)
  deviceIdHash?: string;
}
