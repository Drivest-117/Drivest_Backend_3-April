import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';

class SelectCentreDto {
  @IsString()
  centreId!: string;
}

@ApiTags('entitlements')
@Controller('entitlements')
export class EntitlementsController {
  constructor(private entService: EntitlementsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  async list(@Req() req: any) {
    const entitlements = await this.entService.userEntitlements(req.user.userId);
    return entitlements;
  }

  @Get('app')
  async listForAppUser(
    @Headers('x-app-user-id') appUserIdHeader: string | string[] | undefined,
    @Headers('x-device-id') deviceIdHeader: string | string[] | undefined,
  ) {
    const appUserId = this.readHeader(appUserIdHeader);
    const deviceId = this.readHeader(deviceIdHeader);
    return this.entService.userEntitlementsByAppUserId(appUserId, deviceId);
  }

  @Post('app/select-centre')
  async selectCentreForPractice(
    @Headers('x-app-user-id') appUserIdHeader: string | string[] | undefined,
    @Headers('x-device-id') deviceIdHeader: string | string[] | undefined,
    @Body() dto: SelectCentreDto,
  ) {
    const appUserId = this.readHeader(appUserIdHeader);
    const deviceId = this.readHeader(deviceIdHeader);
    return this.entService.selectCentreForPractice(appUserId, dto.centreId, deviceId);
  }

  private readHeader(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
      return String(value[0] ?? '').trim();
    }
    return String(value ?? '').trim();
  }
}
