import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoutesService } from './routes.service';

@ApiTags('centres')
@Controller('centres')
export class CentreHazardsController {
  constructor(private readonly routesService: RoutesService) {}

  @Get(':id/hazards')
  async centreHazards(@Param('id') centreIdOrSlug: string) {
    return this.routesService.getCentreHazardsPublic(centreIdOrSlug);
  }
}
