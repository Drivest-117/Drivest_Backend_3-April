import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConfirmLessonStripePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  checkoutSessionId: string;
}
