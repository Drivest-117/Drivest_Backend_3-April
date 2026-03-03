import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInstructorProfileDto } from './dto/create-instructor-profile.dto';
import { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';
import { ListInstructorsQueryDto } from './dto/list-instructors-query.dto';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('v1/instructors')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  async createProfile(@Req() req: { user: { userId: string; role?: string } }, @Body() dto: CreateInstructorProfileDto) {
    return this.instructorsService.createProfile(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Req() req: { user: { userId: string; role?: string } }, @Body() dto: UpdateInstructorProfileDto) {
    return this.instructorsService.updateProfile(req.user, dto);
  }

  @Get('public')
  async listPublic(@Query() query: ListInstructorsQueryDto) {
    return this.instructorsService.listPublic(query);
  }

  @Get('public/:id')
  async publicProfile(@Param('id') id: string) {
    return this.instructorsService.getPublicProfile(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reviews')
  async createReview(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') instructorId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.instructorsService.createReview(req.user, instructorId, dto);
  }
}
