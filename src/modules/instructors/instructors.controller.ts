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
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { ListAvailabilityQueryDto } from './dto/list-availability-query.dto';
import { ListLocationSuggestionsQueryDto } from './dto/list-location-suggestions-query.dto';
import { SubmitLearnerLinkRequestDto } from './dto/submit-learner-link-request.dto';

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

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async myProfile(@Req() req: { user: { userId: string; role?: string } }) {
    return this.instructorsService.getMyProfile(req.user);
  }

  @Get('public')
  async listPublic(@Query() query: ListInstructorsQueryDto) {
    return this.instructorsService.listPublic(query);
  }

  @Get('public/location-suggestions')
  async listPublicLocationSuggestions(@Query() query: ListLocationSuggestionsQueryDto) {
    return this.instructorsService.listPublicLocationSuggestions(query.q, query.limit ?? 8);
  }

  @Get('public/:id')
  async publicProfile(@Param('id') id: string) {
    return this.instructorsService.getPublicProfile(id);
  }

  @Get('public/:id/availability')
  async publicAvailability(@Param('id') id: string, @Query() query: ListAvailabilityQueryDto) {
    return this.instructorsService.getPublicAvailability(id, query.month);
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

  @UseGuards(JwtAuthGuard)
  @Get('availability/me')
  async myAvailability(
    @Req() req: { user: { userId: string; role?: string } },
    @Query() query: ListAvailabilityQueryDto,
  ) {
    return this.instructorsService.listMyAvailability(req.user, query.month);
  }

  @UseGuards(JwtAuthGuard)
  @Post('availability')
  async createAvailability(
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateAvailabilitySlotDto,
  ) {
    return this.instructorsService.createAvailabilitySlot(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('availability/:id/cancel')
  async cancelAvailability(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') slotId: string,
  ) {
    return this.instructorsService.cancelAvailabilitySlot(req.user, slotId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('linking/share-code')
  async getInstructorShareCode(@Req() req: { user: { userId: string; role?: string } }) {
    return this.instructorsService.getInstructorShareCode(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('linking/share-code/regenerate')
  async regenerateInstructorShareCode(
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.instructorsService.regenerateInstructorShareCode(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('linking/requests')
  async submitLearnerLinkRequest(
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: SubmitLearnerLinkRequestDto,
  ) {
    return this.instructorsService.submitLearnerLinkRequest(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('linking/requests/pending')
  async listPendingLinkRequests(@Req() req: { user: { userId: string; role?: string } }) {
    return this.instructorsService.listInstructorPendingLinkRequests(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('linking/requests/:id/approve')
  async approveLinkRequest(
    @Req() req: { user: { userId: string; role?: string } },
    @Param('id') linkId: string,
  ) {
    return this.instructorsService.approveInstructorLinkRequest(req.user, linkId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('linking/instructor/learners')
  async listInstructorLinkedLearners(
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.instructorsService.listInstructorLinkedLearners(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('linking/learner/instructors')
  async listLearnerInstructorLinks(
    @Req() req: { user: { userId: string; role?: string } },
  ) {
    return this.instructorsService.listLearnerInstructorLinks(req.user);
  }
}
