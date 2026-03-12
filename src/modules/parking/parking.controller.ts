import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ParkingService } from './parking.service';
import { ParkingSearchDto } from './dto/parking-search.dto';
import { ParkingImportCouncilDto } from './dto/parking-import-council.dto';

@ApiTags('parking')
@Controller()
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Get('v1/parking/search')
  async search(@Query() query: ParkingSearchDto) {
    return this.parkingService.search(query);
  }

  @Get('parking/search')
  async searchLegacy(@Query() query: ParkingSearchDto) {
    return this.parkingService.search(query);
  }

  @Get('v1/parking/councils')
  async councils() {
    return this.parkingService.listCouncils();
  }

  @Get('parking/councils')
  async councilsLegacy() {
    return this.parkingService.listCouncils();
  }

  @Get('v1/parking/spot/:id')
  async spot(@Param('id') id: string, @Query('at') at?: string) {
    return this.parkingService.findSpot(id, at);
  }

  @Get('parking/spot/:id')
  async spotLegacy(@Param('id') id: string, @Query('at') at?: string) {
    return this.parkingService.findSpot(id, at);
  }

  @Post('v1/parking/ingest/council/:id')
  async ingestCouncil(
    @Param('id') id: string,
    @Query('radius_m') radiusM?: string,
    @Query('max_results') maxResults?: string,
  ) {
    return this.parkingService.ingestCouncil(
      id,
      radiusM ? Number(radiusM) : undefined,
      maxResults ? Number(maxResults) : undefined,
    );
  }

  @Post('parking/ingest/council/:id')
  async ingestCouncilLegacy(
    @Param('id') id: string,
    @Query('radius_m') radiusM?: string,
    @Query('max_results') maxResults?: string,
  ) {
    return this.parkingService.ingestCouncil(
      id,
      radiusM ? Number(radiusM) : undefined,
      maxResults ? Number(maxResults) : undefined,
    );
  }

  @Post('v1/parking/ingest/bootstrap')
  async ingestBootstrap(@Query('limit') limit?: string) {
    return this.parkingService.ingestBootstrap(limit ? Number(limit) : undefined);
  }

  @Post('parking/ingest/bootstrap')
  async ingestBootstrapLegacy(@Query('limit') limit?: string) {
    return this.parkingService.ingestBootstrap(limit ? Number(limit) : undefined);
  }

  @Post('v1/parking/atlas/sync')
  async syncAtlas() {
    return this.parkingService.syncAtlasFromRepository();
  }

  @Post('parking/atlas/sync')
  async syncAtlasLegacy() {
    return this.parkingService.syncAtlasFromRepository();
  }

  @Post('v1/parking/atlas/import/council')
  async importCouncil(@Body() body: ParkingImportCouncilDto) {
    return this.parkingService.importCouncilFeed(body);
  }

  @Post('parking/atlas/import/council')
  async importCouncilLegacy(@Body() body: ParkingImportCouncilDto) {
    return this.parkingService.importCouncilFeed(body);
  }
}
