import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonStatusDto } from './dto/update-lesson-status.dto';

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
  @Get('my')
  async myLessons(@Req() req: { user: { userId: string; role?: string } }) {
    return this.instructorsService.listMyLessons(req.user);
  }
}
