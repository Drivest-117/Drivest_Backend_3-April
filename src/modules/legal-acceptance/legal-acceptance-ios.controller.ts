import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LegalAcceptanceService } from './legal-acceptance.service';
import { MarketplaceLegalSurface } from './legal-acceptance.constants';

@Controller('v1/instructors/legal/acceptance')
export class LegalAcceptanceIosController {
  constructor(private readonly legalAcceptanceService: LegalAcceptanceService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':surface')
  async getSurfaceAcceptance(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('surface') surface: MarketplaceLegalSurface,
  ) {
    const state = await this.legalAcceptanceService.getCurrentAcceptance(req.user, surface);
    return this.toIosShape(state);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':surface')
  async acceptSurface(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('surface') surface: MarketplaceLegalSurface,
    @Body() dto: { metadata?: Record<string, unknown> },
  ) {
    const state = await this.legalAcceptanceService.acceptCurrentVersion(
      req.user,
      surface,
      dto.metadata,
    );
    return this.toIosShape(state);
  }

  private toIosShape(state: {
    surface: string;
    currentVersion: string;
    acceptance?: { version?: string; acceptedAt?: Date | null } | null;
  }) {
    return {
      surface: state.surface,
      currentVersion: state.currentVersion,
      acceptedVersion: state.acceptance?.version ?? null,
      acceptedAt: state.acceptance?.acceptedAt ?? null,
      isAcceptedCurrentVersion:
        Boolean(state.acceptance?.version) &&
        state.acceptance?.version === state.currentVersion,
    };
  }
}
