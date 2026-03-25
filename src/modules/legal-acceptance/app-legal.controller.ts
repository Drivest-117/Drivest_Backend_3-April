import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { RecordAppLegalAcceptanceDto } from './dto/record-app-legal-acceptance.dto';
import { UpdateAppConsentsDto } from './dto/update-app-consents.dto';
import { AppLegalService } from './app-legal.service';

@ApiTags('legal')
@Controller('v1/legal/app')
export class AppLegalController {
  constructor(private readonly appLegalService: AppLegalService) {}

  @Get('bootstrap')
  async bootstrap(@Req() req: Request) {
    return this.appLegalService.getBootstrapState(req);
  }

  @Post('acceptance')
  async recordAcceptance(@Req() req: Request, @Body() dto: RecordAppLegalAcceptanceDto) {
    return this.appLegalService.recordLegalAcceptance(req, dto);
  }

  @Post('consents')
  async recordConsents(@Req() req: Request, @Body() dto: UpdateAppConsentsDto) {
    return this.appLegalService.updateAppConsents(req, dto);
  }
}

