import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InstructorsService } from './instructors.service';
import { AdminFinanceReportQueryDto } from './dto/admin-finance-report-query.dto';
import { AdminFinanceRepairDto } from './dto/admin-finance-repair.dto';

@Controller('v1/admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class InstructorsFinanceAdminController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @Get('summary')
  async summary(@Query() query: AdminFinanceReportQueryDto) {
    return this.instructorsService.getAdminFinanceSummary(query);
  }

  @Get('instructors')
  async byInstructor(@Query() query: AdminFinanceReportQueryDto) {
    return this.instructorsService.getAdminFinanceByInstructor(query);
  }

  @Get('lessons')
  async lessons(@Query() query: AdminFinanceReportQueryDto) {
    return this.instructorsService.getAdminFinanceLessons(query);
  }

  @Post('repair')
  async repair(@Body() dto: AdminFinanceRepairDto) {
    return this.instructorsService.repairLessonFinanceSnapshots(dto);
  }
}
