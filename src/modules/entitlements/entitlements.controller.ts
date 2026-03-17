import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

class SelectCentreDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('app')
  async listForAppUser(@Req() req: any) {
    return this.entService.userEntitlements(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('app/select-centre')
  async selectCentreForPractice(@Req() req: any, @Body() dto: SelectCentreDto) {
    return this.entService.selectCentreForPractice(req.user.userId, dto.centreId);
  }
}
