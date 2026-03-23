import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActivateLessonApplePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  productId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  transactionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  originalTransactionId?: string;

  @IsOptional()
  @IsDateString()
  purchasedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  environment?: string;

  @IsOptional()
  @IsBoolean()
  isRestore?: boolean;
}
