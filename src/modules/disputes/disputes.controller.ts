import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AddDisputeEvidenceDto } from './dto/add-dispute-evidence.dto';
import { CreateDisputeCaseDto } from './dto/create-dispute-case.dto';
import { ListDisputeCasesQueryDto } from './dto/list-dispute-cases-query.dto';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto';
import { DisputesService } from './disputes.service';

@Controller('v1/disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async openCase(
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateDisputeCaseDto,
  ) {
    return this.disputesService.openCase(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async myCases(
    @Req() req: { user: { userId: string; role?: string } },
    @Query() query: ListDisputeCasesQueryDto,
  ) {
    return this.disputesService.listCases(req.user, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async caseById(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') disputeCaseId: string,
  ) {
    return this.disputesService.getCaseById(req.user, disputeCaseId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/evidence')
  async addEvidence(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') disputeCaseId: string,
    @Body() dto: AddDisputeEvidenceDto,
  ) {
    return this.disputesService.addEvidence(req.user, disputeCaseId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/status')
  async updateStatus(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') disputeCaseId: string,
    @Body() dto: UpdateDisputeStatusDto,
  ) {
    return this.disputesService.updateStatusAsAdmin(req.user, disputeCaseId, dto);
  }
}
