import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NearbyHazardsDto } from './dto/nearby-hazards.dto';
import { RoutesService } from './routes.service';

@ApiTags('navigation')
@Controller('navigation')
export class NavigationController {
  constructor(private readonly routesService: RoutesService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('hazards/nearby')
  async nearbyHazards(@Req() req: any, @Body() dto: NearbyHazardsDto) {
    return this.routesService.getNearbyHazards(req.user.userId, dto);
  }

  @Post('app/hazards/nearby')
  async nearbyHazardsForAppUser(@Req() req: any, @Body() dto: NearbyHazardsDto) {
    const appUserId = this.readHeader(req?.headers?.['x-app-user-id']);
    const deviceId = this.readHeader(req?.headers?.['x-device-id']);
    return this.routesService.getNearbyHazardsByAppUserId(appUserId, dto, deviceId);
  }

  private readHeader(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
      return String(value[0] ?? '').trim();
    }
    return String(value ?? '').trim();
  }
}
