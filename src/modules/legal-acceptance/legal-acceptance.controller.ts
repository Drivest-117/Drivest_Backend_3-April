import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AcceptLegalSurfaceDto } from './dto/accept-legal-surface.dto';
import { GetLegalAcceptanceStateQueryDto } from './dto/get-legal-acceptance-state-query.dto';
import { LegalAcceptanceService } from './legal-acceptance.service';

@Controller('v1/legal/acceptance')
export class LegalAcceptanceController {
  constructor(private readonly legalAcceptanceService: LegalAcceptanceService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getCurrentAcceptance(
    @Req() req: { user: { userId: string; role?: string } },
    @Query() query: GetLegalAcceptanceStateQueryDto,
  ) {
    return this.legalAcceptanceService.getCurrentAcceptance(req.user, query.surface);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async acceptSurface(
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: AcceptLegalSurfaceDto,
  ) {
    return this.legalAcceptanceService.acceptCurrentVersion(req.user, dto.surface, dto.metadata);
  }
}
