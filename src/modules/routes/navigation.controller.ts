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
}
