import {
  Body,
  Controller,
  Get,
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('app/:id')
  async getRouteForAppUser(@Req() req: any, @Param('id') id: string) {
    return this.routesService.getRouteForAppUser(req.user.userId, id);
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('app/:id/hazards')
  async getRouteHazardsForAppUser(
    @Req() req: any,
    @Param('id') id: string,
    @Query() query: RouteHazardsQueryDto,
  ) {
    return this.routesService.getRouteHazardsForAppUser(req.user.userId, id, query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/download')
  async download(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    return this.routesService.download(req.user.userId, id, res);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('app/:id/download')
  async downloadForAppUser(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.routesService.downloadForAppUser(req.user.userId, id, res);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/practice/start')
  async start(@Req() req: any, @Param('id') id: string) {
    return this.routesService.startPractice(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('app/:id/practice/start')
  async startForAppUser(@Req() req: any, @Param('id') id: string) {
    return this.routesService.startPracticeForAppUser(req.user.userId, id);
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('app/:id/practice/finish')
  async finishForAppUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: PracticeFinishDto,
  ) {
    return this.routesService.finishPracticeForAppUser(req.user.userId, id, dto);
  }
}
