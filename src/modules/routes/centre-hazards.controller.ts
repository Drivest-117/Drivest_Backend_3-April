import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoutesService } from './routes.service';

@ApiTags('centres')
@Controller('centres')
export class CentreHazardsController {
  constructor(private readonly routesService: RoutesService) {}

  @Get(':id/hazards')
  async centreHazards(
    @Param('id') centreIdOrSlug: string,
    @Headers('x-app-user-id') appUserIdHeader: string | string[] | undefined,
    @Headers('x-device-id') deviceIdHeader: string | string[] | undefined,
  ) {
    const appUserId = this.readHeader(appUserIdHeader);
    const deviceId = this.readHeader(deviceIdHeader);
    return this.routesService.getCentreHazardsByAppUserId(
      appUserId,
      centreIdOrSlug,
      deviceId,
    );
  }

  private readHeader(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
      return String(value[0] ?? '').trim();
    }
    return String(value ?? '').trim();
  }
}
