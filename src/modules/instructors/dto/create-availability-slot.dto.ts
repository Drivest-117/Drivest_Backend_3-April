import { IsDateString } from 'class-validator';

export class CreateAvailabilitySlotDto {
  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;
}
