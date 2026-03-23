import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class InstructorsAdminController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @Get('instructors')
  async listInstructors(@Query('scope') scope?: string) {
    return this.instructorsService.listAdminInstructors(scope);
  }

  @Get('instructors/pending')
  async pendingInstructors() {
    return this.instructorsService.getPendingProfiles();
  }

  @Get('instructors/:id')
  async instructorDetails(@Param('id') instructorId: string) {
    return this.instructorsService.getAdminInstructorProfile(instructorId);
  }

  @Post('instructors/:id/approve')
  async approveInstructor(@Param('id') instructorId: string) {
    return this.instructorsService.approveInstructor(instructorId);
  }

  @Post('instructors/:id/suspend')
  async suspendInstructor(@Param('id') instructorId: string) {
    return this.instructorsService.suspendInstructor(instructorId);
  }

  @Post('reviews/:id/hide')
  async hideReview(@Param('id') reviewId: string) {
    return this.instructorsService.hideReview(reviewId);
  }

  @Post('reviews/:id/remove')
  async removeReview(@Param('id') reviewId: string) {
    return this.instructorsService.removeReview(reviewId);
  }
}
