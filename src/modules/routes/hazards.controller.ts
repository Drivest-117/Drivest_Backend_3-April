import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { BboxHazardsQueryDto } from './dto/bbox-hazards-query.dto';

@ApiTags('hazards')
@Controller('hazards')
export class HazardsController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('route')
  async routeHazards(
    @Query() query: BboxHazardsQueryDto,
    @Headers('x-app-user-id') appUserIdHeader: string | string[] | undefined,
  ) {
    const appUserId = this.readHeader(appUserIdHeader);
    return this.routesService.getRouteHazardsForBoundsByAppUserId(appUserId, query);
  }

  private readHeader(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
      return String(value[0] ?? '').trim();
    }
    return String(value ?? '').trim();
  }
}
