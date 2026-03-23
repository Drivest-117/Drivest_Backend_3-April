import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonStatusDto } from './dto/update-lesson-status.dto';
import { CancelLessonDto } from './dto/cancel-lesson.dto';
import { RescheduleLessonDto } from './dto/reschedule-lesson.dto';
import { ConfirmLessonStripePaymentDto } from './dto/confirm-lesson-stripe-payment.dto';
import { ActivateLessonApplePaymentDto } from './dto/activate-lesson-apple-payment.dto';

@Controller('v1/lessons')
export class LessonsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createLesson(
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateLessonDto,
  ) {
    return this.instructorsService.createLesson(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  async updateStatus(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') lessonId: string,
    @Body() dto: UpdateLessonStatusDto,
  ) {
    return this.instructorsService.updateLessonStatus(req.user, lessonId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  async cancelByLearner(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') lessonId: string,
    @Body() dto: CancelLessonDto,
  ) {
    return this.instructorsService.cancelLessonAsLearner(req.user, lessonId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/reschedule')
  async rescheduleByLearner(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') lessonId: string,
    @Body() dto: RescheduleLessonDto,
  ) {
    return this.instructorsService.rescheduleLessonAsLearner(req.user, lessonId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async myLessons(@Req() req: { user: { userId: string; role?: string } }) {
    return this.instructorsService.listMyLessons(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/payment')
  async getLessonPayment(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') lessonId: string,
  ) {
    return this.instructorsService.getLessonPayment(req.user, lessonId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/payment/stripe/checkout')
  async createStripeCheckout(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') lessonId: string,
  ) {
    return this.instructorsService.createLessonStripeCheckout(req.user, lessonId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/payment/stripe/confirm')
  async confirmStripePayment(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') lessonId: string,
    @Body() dto: ConfirmLessonStripePaymentDto,
  ) {
    return this.instructorsService.confirmLessonStripePayment(req.user, lessonId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/payment/apple/activate')
  async activateApplePayment(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') lessonId: string,
    @Body() dto: ActivateLessonApplePaymentDto,
  ) {
    return this.instructorsService.activateLessonApplePayment(req.user, lessonId, dto);
  }
}
