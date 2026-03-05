import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { BboxHazardsQueryDto } from './dto/bbox-hazards-query.dto';

@ApiTags('hazards')
@Controller('hazards')
export class HazardsController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('route')
  async routeHazards(@Query() query: BboxHazardsQueryDto) {
    return this.routesService.getRouteHazardsForBounds(query);
  }
}
