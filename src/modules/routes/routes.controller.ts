import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { RoutesService } from './routes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PracticeFinishDto } from './dto/practice-finish.dto';
import { RouteHazardsQueryDto } from './dto/route-hazards-query.dto';

@ApiTags('routes')
@Controller('routes')
export class RoutesController {
  constructor(private routesService: RoutesService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  async getRoute(@Req() req: any, @Param('id') id: string) {
    return this.routesService.getRoute(req.user.userId, id);
  }

  @Get('app/:id')
  async getRouteForAppUser(
    @Param('id') id: string,
    @Headers('x-app-user-id') appUserIdHeader: string | string[] | undefined,
    @Headers('x-device-id') deviceIdHeader: string | string[] | undefined,
  ) {
    const appUserId = this.readHeader(appUserIdHeader);
    const deviceId = this.readHeader(deviceIdHeader);
    return this.routesService.getRouteByAppUserId(appUserId, id, deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/hazards')
  async getRouteHazards(
    @Req() req: any,
    @Param('id') id: string,
    @Query() query: RouteHazardsQueryDto,
  ) {
    return this.routesService.getRouteHazards(
      req.user.userId,
      id,
      query,
      req.user?.role,
    );
  }

  @Get('app/:id/hazards')
  async getRouteHazardsForAppUser(
    @Param('id') id: string,
    @Headers('x-app-user-id') appUserIdHeader: string | string[] | undefined,
    @Headers('x-device-id') deviceIdHeader: string | string[] | undefined,
    @Query() query: RouteHazardsQueryDto,
  ) {
    const appUserId = this.readHeader(appUserIdHeader);
    const deviceId = this.readHeader(deviceIdHeader);
    return this.routesService.getRouteHazardsByAppUserId(
      appUserId,
      id,
      query,
      deviceId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/download')
  async download(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    return this.routesService.download(req.user.userId, id, res);
  }

  @Get('app/:id/download')
  async downloadForAppUser(
    @Param('id') id: string,
    @Headers('x-app-user-id') appUserIdHeader: string | string[] | undefined,
    @Headers('x-device-id') deviceIdHeader: string | string[] | undefined,
    @Res() res: Response,
  ) {
    const appUserId = this.readHeader(appUserIdHeader);
    const deviceId = this.readHeader(deviceIdHeader);
    return this.routesService.downloadByAppUserId(appUserId, id, res, deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/practice/start')
  async start(@Req() req: any, @Param('id') id: string) {
    return this.routesService.startPractice(req.user.userId, id);
  }

  @Post('app/:id/practice/start')
  async startForAppUser(
    @Param('id') id: string,
    @Headers('x-app-user-id') appUserIdHeader: string | string[] | undefined,
    @Headers('x-device-id') deviceIdHeader: string | string[] | undefined,
  ) {
    const appUserId = this.readHeader(appUserIdHeader);
    const deviceId = this.readHeader(deviceIdHeader);
    return this.routesService.startPracticeByAppUserId(appUserId, id, deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/practice/finish')
  async finish(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: PracticeFinishDto,
  ) {
    return this.routesService.finishPractice(req.user.userId, id, dto);
  }

  @Post('app/:id/practice/finish')
  async finishForAppUser(
    @Param('id') id: string,
    @Headers('x-app-user-id') appUserIdHeader: string | string[] | undefined,
    @Headers('x-device-id') deviceIdHeader: string | string[] | undefined,
    @Body() dto: PracticeFinishDto,
  ) {
    const appUserId = this.readHeader(appUserIdHeader);
    const deviceId = this.readHeader(deviceIdHeader);
    return this.routesService.finishPracticeByAppUserId(appUserId, id, dto, deviceId);
  }

  private readHeader(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
      return String(value[0] ?? '').trim();
    }
    return String(value ?? '').trim();
  }
}
