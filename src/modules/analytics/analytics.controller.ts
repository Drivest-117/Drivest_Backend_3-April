import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AnalyticsService } from './analytics.service';
import { SyncAnalyticsDto } from './dto/sync-analytics.dto';

@ApiTags('analytics')
@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('me/sync')
  async syncMyAnalytics(
    @Req() req: { user: { userId: string } },
    @Body() dto: SyncAnalyticsDto,
  ) {
    return this.analyticsService.syncForUser(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me/summary')
  async myAnalyticsSummary(@Req() req: { user: { userId: string } }) {
    return this.analyticsService.getMySummary(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiBearerAuth()
  @Get('instructor/learners')
  async instructorLearnerAnalytics(
    @Req() req: { user: { userId: string; role?: string } },
    @Query('instructorId') instructorId?: string,
  ) {
    return this.analyticsService.getInstructorLearnerAnalytics(
      req.user.userId,
      req.user.role,
      instructorId,
    );
  }
}
