import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { InstructorsService } from "./instructors.service";
import { ReportReviewDto } from "./dto/report-review.dto";

@Controller("v1/reviews")
export class ReviewsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me/pending")
  async listPendingReviews(
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.instructorsService.listPendingReviews(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/report")
  async reportReview(
    @Req() req: { user: { userId: string; role?: string } },
    @Param("id") reviewId: string,
    @Body() dto: ReportReviewDto,
  ) {
    return this.instructorsService.reportReview(req.user, reviewId, dto);
  }
}
