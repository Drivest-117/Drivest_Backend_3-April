import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ReferralsService } from "./referrals.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ListReferralEventsQueryDto } from "./dto/list-referral-events-query.dto";
import { ListReferralPayoutsQueryDto } from "./dto/list-referral-payouts-query.dto";
import { ReviewReferralEventDto } from "./dto/review-referral-event.dto";
import { UpdateReferralPayoutStatusDto } from "./dto/update-referral-payout-status.dto";

@ApiTags("Referrals")
@ApiBearerAuth()
@Controller("v1/referrals")
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @UseGuards(JwtAuthGuard)
  @Get("metrics")
  async getMyMetrics(@Request() req: any) {
    return this.referralsService.getReferrerMetrics(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("invite-link")
  async getMyInviteLink(
    @Request() req: any,
    @Query("refType") refType?: string,
  ) {
    return this.referralsService.generateInviteLink(
      req.user.userId,
      req.user.role,
      refType,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get("admin/events")
  async listAdminEvents(@Query() query: ListReferralEventsQueryDto) {
    return this.referralsService.listAdminReferralEvents(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post("admin/events/:eventId/review")
  async reviewAdminEvent(
    @Param("eventId") eventId: string,
    @Body() dto: ReviewReferralEventDto,
    @Request() req: any,
  ) {
    return this.referralsService.reviewReferralEvent(
      eventId,
      dto,
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get("admin/payouts")
  async listAdminPayouts(@Query() query: ListReferralPayoutsQueryDto) {
    return this.referralsService.listAdminReferralPayouts(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post("admin/payouts/:payoutId/payment-status")
  async setAdminPayoutPaymentStatus(
    @Param("payoutId") payoutId: string,
    @Body() dto: UpdateReferralPayoutStatusDto,
    @Request() req: any,
  ) {
    return this.referralsService.setReferralPayoutPaidStatus(
      payoutId,
      dto.isPaid,
      req.user.userId,
    );
  }
}
