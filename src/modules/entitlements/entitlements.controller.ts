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
import { SubscribePracticeDto } from './dto/subscribe-practice.dto';
import { SubscribeNavigationBundleDto } from './dto/subscribe-navigation-bundle.dto';
import { ActivateApplePurchaseDto } from './dto/activate-apple-purchase.dto';
import { SimpleThrottle } from '../../common/simple-throttle.decorator';
import { SimpleThrottleGuard } from '../../common/simple-throttle.guard';

class SelectCentreDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  centreId!: string;
}

@ApiTags('entitlements')
@Controller(['entitlements', 'v1/entitlements'])
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
  @Get('app/access-state')
  async appAccessState(@Req() req: any) {
    return this.entService.appAccessState(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('app/select-centre')
  async selectCentreForPractice(@Req() req: any, @Body() dto: SelectCentreDto) {
    return this.entService.selectCentreForPractice(req.user.userId, dto.centreId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('app/subscribe')
  async subscribeForPractice(@Req() req: any, @Body() dto: SubscribePracticeDto) {
    return this.entService.subscribeMonthly(req.user.userId, dto.centreId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('app/subscribe/navigation-monthly')
  async subscribeNavigationMonthly(@Req() req: any) {
    return this.entService.subscribeNavigationMonthly(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('app/subscribe/navigation-bundle')
  async subscribeNavigationBundle(
    @Req() req: any,
    @Body() dto: SubscribeNavigationBundleDto,
  ) {
    return this.entService.subscribeNavigationBundle(req.user.userId, dto.centreId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('app/cancel-subscription')
  async cancelPracticeSubscription(@Req() req: any) {
    return this.entService.cancelMonthlySubscription(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('app/apple/activate')
  @UseGuards(SimpleThrottleGuard)
  @SimpleThrottle(20, 15 * 60 * 1000)
  async activateApplePurchase(
    @Req() req: any,
    @Body() dto: ActivateApplePurchaseDto,
  ) {
    return this.entService.activateApplePurchase(req.user.userId, dto);
  }
}
