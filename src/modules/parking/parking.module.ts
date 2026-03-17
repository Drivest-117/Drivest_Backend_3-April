import { Module } from '@nestjs/common';
import { ParkingController } from './parking.controller';
import { ParkingService } from './parking.service';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [ParkingController],
  providers: [ParkingService, RolesGuard],
})
export class ParkingModule {}
