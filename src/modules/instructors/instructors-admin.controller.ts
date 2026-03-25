import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { InstructorsService } from "./instructors.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ListAdminReviewsQueryDto } from "./dto/list-admin-reviews-query.dto";
import { ModerateReviewDto } from "./dto/moderate-review.dto";

@Controller("v1/admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class InstructorsAdminController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @Get("instructors")
  async listInstructors(@Query("scope") scope?: string) {
    return this.instructorsService.listAdminInstructors(scope);
  }

  @Get("instructors/pending")
  async pendingInstructors() {
    return this.instructorsService.getPendingProfiles();
  }

  @Get("instructors/:id")
  async instructorDetails(@Param("id") instructorId: string) {
    return this.instructorsService.getAdminInstructorProfile(instructorId);
  }

  @Post("instructors/:id/approve")
  async approveInstructor(@Param("id") instructorId: string) {
    return this.instructorsService.approveInstructor(instructorId);
  }

  @Post("instructors/:id/suspend")
  async suspendInstructor(@Param("id") instructorId: string) {
    return this.instructorsService.suspendInstructor(instructorId);
  }

  @Get("reviews")
  async listReviews(@Query() query: ListAdminReviewsQueryDto) {
    return this.instructorsService.listAdminReviews(query);
  }

  @Get("reviews/:id")
  async reviewDetails(@Param("id") reviewId: string) {
    return this.instructorsService.getAdminReviewDetail(reviewId);
  }

  @Post("reviews/:id/flag")
  async flagReview(
    @Req() req: { user: { userId: string } },
    @Param("id") reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.instructorsService.flagReview(
      reviewId,
      req.user.userId,
      dto.reason,
    );
  }

  @Post("reviews/:id/hide")
  async hideReview(
    @Req() req: { user: { userId: string } },
    @Param("id") reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.instructorsService.hideReview(
      reviewId,
      req.user.userId,
      dto.reason,
    );
  }

  @Post("reviews/:id/remove")
  async removeReview(
    @Req() req: { user: { userId: string } },
    @Param("id") reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.instructorsService.removeReview(
      reviewId,
      req.user.userId,
      dto.reason,
    );
  }

  @Post("reviews/:id/restore")
  async restoreReview(
    @Req() req: { user: { userId: string } },
    @Param("id") reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.instructorsService.restoreReview(
      reviewId,
      req.user.userId,
      dto.reason,
    );
  }
}
