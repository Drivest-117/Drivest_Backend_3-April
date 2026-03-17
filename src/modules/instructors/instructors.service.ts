import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { InstructorEntity } from './entities/instructor.entity';
import { InstructorReviewEntity } from './entities/instructor-review.entity';
import { LessonEntity } from './entities/lesson.entity';
import { InstructorAvailabilityEntity } from './entities/instructor-availability.entity';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { CreateInstructorProfileDto } from './dto/create-instructor-profile.dto';
import { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';
import { ListInstructorsQueryDto } from './dto/list-instructors-query.dto';
import { AuthenticatedRequestUser, normaliseRole } from './instructors.types';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonStatusDto } from './dto/update-lesson-status.dto';
import { CancelLessonDto } from './dto/cancel-lesson.dto';
import { RescheduleLessonDto } from './dto/reschedule-lesson.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InstructorsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(InstructorEntity)
    private readonly instructorsRepo: Repository<InstructorEntity>,
    @InjectRepository(InstructorReviewEntity)
    private readonly reviewsRepo: Repository<InstructorReviewEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonsRepo: Repository<LessonEntity>,
    @InjectRepository(InstructorAvailabilityEntity)
    private readonly availabilityRepo: Repository<InstructorAvailabilityEntity>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createProfile(user: AuthenticatedRequestUser, dto: CreateInstructorProfileDto) {
    this.requireRole(user, 'instructor');

    const existing = await this.instructorsRepo.findOne({ where: { userId: user.userId } });
    if (existing) {
      throw new BadRequestException('Instructor profile already exists');
    }

    const profile = this.instructorsRepo.create({
      userId: user.userId,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone ?? null,
      adiNumber: dto.adiNumber,
      profilePhotoUrl: dto.profilePhotoUrl ?? null,
      yearsExperience: dto.yearsExperience ?? null,
      transmissionType: dto.transmissionType,
      hourlyRatePence: dto.hourlyRatePence ?? null,
      bio: dto.bio ?? null,
      languages: dto.languages ?? null,
      coveragePostcodes: this.normaliseCoverageAreas(dto.coveragePostcodes),
      homeLocation: this.toPoint(dto.homeLat, dto.homeLng),
      isApproved: false,
      approvedAt: null,
      suspendedAt: null,
    });

    return this.instructorsRepo.save(profile);
  }

  async updateProfile(user: AuthenticatedRequestUser, dto: UpdateInstructorProfileDto) {
    this.requireRole(user, 'instructor');

    const profile = await this.instructorsRepo.findOne({ where: { userId: user.userId } });
    if (!profile) {
      throw new NotFoundException('Instructor profile not found');
    }

    const adiChanged = typeof dto.adiNumber === 'string' && dto.adiNumber !== profile.adiNumber;

    Object.assign(profile, {
      fullName: dto.fullName ?? profile.fullName,
      email: dto.email ?? profile.email,
      phone: dto.phone ?? profile.phone,
      adiNumber: dto.adiNumber ?? profile.adiNumber,
      profilePhotoUrl: dto.profilePhotoUrl ?? profile.profilePhotoUrl,
      yearsExperience: dto.yearsExperience ?? profile.yearsExperience,
      transmissionType: dto.transmissionType ?? profile.transmissionType,
      hourlyRatePence: dto.hourlyRatePence ?? profile.hourlyRatePence,
      bio: dto.bio ?? profile.bio,
      languages: dto.languages ?? profile.languages,
      coveragePostcodes:
        dto.coveragePostcodes !== undefined
          ? this.normaliseCoverageAreas(dto.coveragePostcodes)
          : profile.coveragePostcodes,
    });

    if (dto.homeLat !== undefined || dto.homeLng !== undefined) {
      const lat = dto.homeLat ?? null;
      const lng = dto.homeLng ?? null;
      profile.homeLocation = this.toPoint(lat, lng);
    }

    if (adiChanged) {
      profile.isApproved = false;
      profile.approvedAt = null;
    }

    return this.instructorsRepo.save(profile);
  }

  async getMyProfile(user: AuthenticatedRequestUser) {
    this.requireRole(user, 'instructor');

    const profile = await this.instructorsRepo.findOne({ where: { userId: user.userId } });
    if (!profile || profile.deletedAt) {
      throw new NotFoundException('Instructor profile not found');
    }

    return {
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      adiNumber: profile.adiNumber,
      profilePhotoUrl: profile.profilePhotoUrl,
      yearsExperience: profile.yearsExperience,
      transmissionType: profile.transmissionType,
      hourlyRatePence: profile.hourlyRatePence,
      bio: profile.bio,
      languages: profile.languages ?? [],
      coveragePostcodes: profile.coveragePostcodes ?? [],
      isApproved: profile.isApproved,
      approvedAt: profile.approvedAt,
      suspendedAt: profile.suspendedAt,
    };
  }

  async listPublic(query: ListInstructorsQueryDto) {
    const radius = query.radiusMeters ?? 10000;

    const qb = this.instructorsRepo
      .createQueryBuilder('i')
      .leftJoin(
        'instructor_rating_summaries',
        'rs',
        'rs.instructor_id = i.id',
      )
      .where('i.deleted_at IS NULL')
      .andWhere('i.is_approved = true')
      .andWhere('i.suspended_at IS NULL');

    if (query.transmissionType) {
      qb.andWhere('i.transmission_type = :transmissionType', {
        transmissionType: query.transmissionType,
      });
    }

    if (query.language) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM unnest(i.languages) AS lang
          WHERE lower(lang) = lower(:language)
        )`,
        { language: query.language },
      );
    }

    const locationQuery = (query.location ?? query.postcode ?? query.city)?.trim();
    if (locationQuery) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM unnest(i.coverage_postcodes) AS pc
          WHERE lower(pc) LIKE lower(:locationLike)
        )`,
        { locationLike: `%${locationQuery}%` },
      );
    }

    if (query.lat !== undefined && query.lng !== undefined) {
      qb.andWhere('i.home_location IS NOT NULL')
        .andWhere(
          'ST_DWithin(i.home_location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)',
          {
            lng: query.lng,
            lat: query.lat,
            radius,
          },
        )
        .addSelect(
          'ST_Distance(i.home_location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)',
          'distance_meters',
        );
    } else {
      qb.addSelect('NULL::float', 'distance_meters');
    }

    qb
      .addSelect('i.id', 'id')
      .addSelect('i.full_name', 'full_name')
      .addSelect('i.profile_photo_url', 'profile_photo_url')
      .addSelect('i.hourly_rate_pence', 'hourly_rate_pence')
      .addSelect('i.transmission_type', 'transmission_type')
      .addSelect('i.languages', 'languages')
      .addSelect('i.coverage_postcodes', 'coverage_postcodes')
      .addSelect('COALESCE(rs.rating_avg, 0)', 'rating_avg')
      .addSelect('COALESCE(rs.rating_count, 0)', 'rating_count');

    if (query.minRating !== undefined) {
      qb.andWhere('COALESCE(rs.rating_avg, 0) >= :minRating', { minRating: query.minRating });
    }

    const rows = await qb
      .orderBy('distance_meters', 'ASC', 'NULLS LAST')
      .addOrderBy('rating_avg', 'DESC')
      .addOrderBy('rating_count', 'DESC')
      .getRawMany();

    return rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      profilePhotoUrl: row.profile_photo_url,
      hourlyRatePence: row.hourly_rate_pence !== null ? Number(row.hourly_rate_pence) : null,
      transmissionType: row.transmission_type,
      languages: row.languages ?? [],
      distanceMeters: row.distance_meters !== null ? Number(row.distance_meters) : null,
      ratingAvg: Number(row.rating_avg ?? 0),
      ratingCount: Number(row.rating_count ?? 0),
      coveragePostcodes: row.coverage_postcodes ?? [],
    }));
  }

  async getPublicProfile(instructorId: string) {
    const profile = await this.instructorsRepo.findOne({
      where: {
        id: instructorId,
        isApproved: true,
        suspendedAt: IsNull(),
      },
    });

    if (!profile || profile.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }

    const summary = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('COALESCE(AVG(r.rating), 0)', 'rating_avg')
      .addSelect('COUNT(r.id)', 'rating_count')
      .where('r.instructor_id = :instructorId', { instructorId })
      .andWhere("r.status = 'visible'")
      .andWhere('r.deleted_at IS NULL')
      .getRawOne<{ rating_avg: string; rating_count: string }>();

    const reviews = await this.reviewsRepo
      .createQueryBuilder('r')
      .where('r.instructor_id = :instructorId', { instructorId })
      .andWhere("r.status = 'visible'")
      .andWhere('r.deleted_at IS NULL')
      .orderBy('r.created_at', 'DESC')
      .limit(10)
      .getMany();

    return {
      id: profile.id,
      fullName: profile.fullName,
      profilePhotoUrl: profile.profilePhotoUrl,
      bio: profile.bio,
      hourlyRatePence: profile.hourlyRatePence,
      transmissionType: profile.transmissionType,
      languages: profile.languages ?? [],
      areas: profile.coveragePostcodes ?? [],
      ratingAvg: Number(summary?.rating_avg ?? 0),
      ratingCount: Number(summary?.rating_count ?? 0),
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        reviewText: review.reviewText,
        createdAt: review.createdAt,
      })),
    };
  }

  async getPublicAvailability(instructorId: string, month?: string) {
    const profile = await this.instructorsRepo.findOne({
      where: {
        id: instructorId,
        isApproved: true,
        suspendedAt: IsNull(),
      },
    });

    if (!profile || profile.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }

    const { monthStart, monthEnd } = this.resolveMonthWindow(month);
    const slots = await this.availabilityRepo
      .createQueryBuilder('s')
      .where('s.instructor_id = :instructorId', { instructorId })
      .andWhere('s.deleted_at IS NULL')
      .andWhere("s.status = 'open'")
      .andWhere('s.starts_at >= :monthStart', { monthStart })
      .andWhere('s.starts_at < :monthEnd', { monthEnd })
      .orderBy('s.starts_at', 'ASC')
      .getMany();

    return slots.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: slot.status,
    }));
  }

  async listMyAvailability(user: AuthenticatedRequestUser, month?: string) {
    this.requireRole(user, 'instructor');
    const instructor = await this.findInstructorForUser(user.userId);
    if (!instructor) {
      return [];
    }
    const { monthStart, monthEnd } = this.resolveMonthWindow(month);

    const slots = await this.availabilityRepo
      .createQueryBuilder('s')
      .where('s.instructor_id = :instructorId', { instructorId: instructor.id })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.starts_at >= :monthStart', { monthStart })
      .andWhere('s.starts_at < :monthEnd', { monthEnd })
      .orderBy('s.starts_at', 'ASC')
      .getMany();

    return slots.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: slot.status,
      bookedLessonId: slot.bookedLessonId,
    }));
  }

  async createAvailabilitySlot(user: AuthenticatedRequestUser, dto: CreateAvailabilitySlotDto) {
    this.requireRole(user, 'instructor');
    const instructor = await this.getOrBootstrapInstructorForUser(user.userId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.validateSlotWindow(startsAt, endsAt);

    await this.ensureNoAvailabilityOverlap(instructor.id, startsAt, endsAt);

    const slot = this.availabilityRepo.create({
      instructorId: instructor.id,
      startsAt,
      endsAt,
      status: 'open',
      bookedLessonId: null,
    });
    return this.availabilityRepo.save(slot);
  }

  async cancelAvailabilitySlot(user: AuthenticatedRequestUser, slotId: string) {
    this.requireRole(user, 'instructor');
    const instructor = await this.getInstructorForUser(user.userId);
    const slot = await this.availabilityRepo.findOne({ where: { id: slotId } });
    if (!slot || slot.deletedAt) {
      throw new NotFoundException('Availability slot not found');
    }
    if (slot.instructorId !== instructor.id) {
      throw new ForbiddenException('You can only manage your own availability');
    }
    if (slot.bookedLessonId) {
      throw new BadRequestException('Booked slot cannot be cancelled');
    }
    slot.status = 'cancelled';
    await this.availabilityRepo.save(slot);
    await this.availabilityRepo.softDelete(slot.id);
    return { success: true };
  }

  async getPendingProfiles() {
    return this.instructorsRepo.find({
      where: { isApproved: false, suspendedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }

  async approveInstructor(instructorId: string) {
    const profile = await this.instructorsRepo.findOne({ where: { id: instructorId } });
    if (!profile || profile.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }
    profile.isApproved = true;
    profile.approvedAt = new Date();
    profile.suspendedAt = null;
    const saved = await this.instructorsRepo.save(profile);
    await this.notificationsService.createForUser(
      profile.userId,
      'app_update',
      'Instructor profile approved',
      'Your instructor profile is now approved and visible to learners.',
      { instructorId: profile.id },
    );
    return saved;
  }

  async suspendInstructor(instructorId: string) {
    const profile = await this.instructorsRepo.findOne({ where: { id: instructorId } });
    if (!profile || profile.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }
    profile.suspendedAt = new Date();
    profile.isApproved = false;
    const saved = await this.instructorsRepo.save(profile);
    await this.notificationsService.createForUser(
      profile.userId,
      'app_update',
      'Instructor profile suspended',
      'Your instructor profile is suspended. Contact support for details.',
      { instructorId: profile.id },
    );
    return saved;
  }

  async hideReview(reviewId: string) {
    const review = await this.reviewsRepo.findOne({ where: { id: reviewId } });
    if (!review || review.deletedAt) {
      throw new NotFoundException('Review not found');
    }
    review.status = 'hidden';
    return this.reviewsRepo.save(review);
  }

  async removeReview(reviewId: string) {
    const review = await this.reviewsRepo.findOne({ where: { id: reviewId } });
    if (!review || review.deletedAt) {
      throw new NotFoundException('Review not found');
    }
    review.status = 'removed';
    await this.reviewsRepo.save(review);
    await this.reviewsRepo.softDelete(review.id);
    return { success: true };
  }

  async createLesson(user: AuthenticatedRequestUser, dto: CreateLessonDto) {
    // Phase 1 decision: learner creates lesson requests, instructors later mark status.
    this.requireRole(user, 'learner');
    if (dto.availabilitySlotId) {
      return this.createLessonFromAvailabilitySlot(user, dto);
    }

    const instructor = await this.instructorsRepo.findOne({ where: { id: dto.instructorId } });
    if (!instructor || instructor.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }
    if (!instructor.isApproved || instructor.suspendedAt) {
      throw new BadRequestException('Instructor is not available for lessons');
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const durationMinutes = dto.durationMinutes ?? null;
    if (scheduledAt && durationMinutes) {
      await this.ensureNoLessonConflicts(instructor.id, scheduledAt, durationMinutes);
    }

    const lesson = this.lessonsRepo.create({
      instructorId: dto.instructorId,
      learnerUserId: user.userId,
      scheduledAt,
      durationMinutes,
      status: 'requested',
      learnerNote: dto.learnerNote ?? null,
      availabilitySlotId: null,
    });
    const savedLesson = await this.lessonsRepo.save(lesson);
    await this.recordLessonAuditEvent(
      'LESSON_CREATED',
      user.userId,
      savedLesson,
      {
        eventVersion: 1,
        actorRole: normaliseRole(user.role) ?? user.role ?? null,
        source: 'direct_request',
        requestedInstructorId: dto.instructorId,
      },
      this.auditRepo,
    );
    await this.notificationsService.createForUser(
      instructor.userId,
      'booking_request',
      'New lesson request',
      'A learner has requested a booking with you.',
      {
        lessonId: savedLesson.id,
        instructorId: instructor.id,
        learnerUserId: user.userId,
        scheduledAt: savedLesson.scheduledAt,
        durationMinutes: savedLesson.durationMinutes,
      },
      user.userId,
    );
    return savedLesson;
  }

  async updateLessonStatus(
    user: AuthenticatedRequestUser,
    lessonId: string,
    dto: UpdateLessonStatusDto,
  ) {
    this.requireRole(user, 'instructor');

    const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId } });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException('Lesson not found');
    }

    const instructor = await this.instructorsRepo.findOne({ where: { id: lesson.instructorId } });
    if (!instructor || instructor.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }
    if (instructor.userId !== user.userId) {
      throw new ForbiddenException('Only the lesson instructor can update lesson status');
    }

    const nextStatus = dto.status;
    const previousStatus = lesson.status;
    const validTransitions: Record<string, string[]> = {
      requested: ['accepted', 'declined', 'completed', 'cancelled'],
      accepted: ['completed', 'cancelled'],
      planned: ['completed', 'cancelled'],
      completed: [],
      declined: [],
      cancelled: [],
    };
    const allowed = validTransitions[lesson.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot change lesson from ${lesson.status} to ${nextStatus}`);
    }

    if (
      nextStatus === 'accepted' &&
      lesson.scheduledAt &&
      lesson.durationMinutes &&
      lesson.status !== 'accepted'
    ) {
      await this.ensureNoLessonConflicts(
        instructor.id,
        lesson.scheduledAt,
        lesson.durationMinutes,
        lesson.id,
      );
    }

    lesson.status = nextStatus;
    const saved = await this.lessonsRepo.save(lesson);
    await this.syncAvailabilitySlotForLessonStatus(saved);
    await this.recordLessonAuditEvent(
      'LESSON_STATUS_UPDATED',
      user.userId,
      saved,
      {
        eventVersion: 1,
        actorRole: normaliseRole(user.role) ?? user.role ?? null,
        previousStatus,
        nextStatus,
      },
      this.auditRepo,
    );
    const learnerMessage =
      nextStatus === 'cancelled'
        ? 'Instructor cancelled this booking. Learner is eligible for full refund and rebooking support.'
        : `Your booking is now ${nextStatus}.`;
    await this.notificationsService.createForUser(
      saved.learnerUserId,
      'booking_status',
      'Booking status updated',
      learnerMessage,
      {
        lessonId: saved.id,
        instructorId: saved.instructorId,
        status: nextStatus,
        availabilitySlotId: saved.availabilitySlotId,
      },
      user.userId,
    );
    if (nextStatus === 'cancelled') {
      await this.notificationsService.createForUser(
        instructor.userId,
        'booking_status',
        'Instructor cancellation policy notice',
        'This cancellation may trigger learner protection and instructor-side penalties.',
        {
          lessonId: saved.id,
          instructorId: saved.instructorId,
          status: nextStatus,
        },
        user.userId,
      );
    }
    return saved;
  }

  async cancelLessonAsLearner(
    user: AuthenticatedRequestUser,
    lessonId: string,
    dto: CancelLessonDto,
  ) {
    this.requireRole(user, 'learner');
    const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId } });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.learnerUserId !== user.userId) {
      throw new ForbiddenException('Only the learner can cancel this lesson');
    }
    if (!this.canLearnerManageLesson(lesson.status)) {
      throw new BadRequestException(`Cannot cancel a lesson in ${lesson.status} state`);
    }

    const window = this.resolveLearnerPolicyWindow(lesson.scheduledAt);
    const previousStatus = lesson.status;
    if (window === 'under_24h' && !dto.emergency) {
      throw new BadRequestException(
        'Cancellations within 24 hours require emergency verification',
      );
    }

    lesson.status = 'cancelled';
    const saved = await this.lessonsRepo.save(lesson);
    await this.syncAvailabilitySlotForLessonStatus(saved);
    await this.recordLessonAuditEvent(
      'LESSON_CANCELLED_BY_LEARNER',
      user.userId,
      saved,
      {
        eventVersion: 1,
        actorRole: normaliseRole(user.role) ?? user.role ?? null,
        previousStatus,
        nextStatus: 'cancelled',
        policyWindow: window,
        emergency: dto.emergency === true,
        note: dto.note ?? null,
      },
      this.auditRepo,
    );

    const instructor = await this.instructorsRepo.findOne({ where: { id: saved.instructorId } });
    if (instructor && !instructor.deletedAt) {
      await this.notificationsService.createForUser(
        instructor.userId,
        'booking_status',
        'Learner cancelled booking',
        this.learnerCancellationMessage(window, dto.emergency === true),
        {
          lessonId: saved.id,
          instructorId: saved.instructorId,
          learnerUserId: saved.learnerUserId,
          policyWindow: window,
          emergency: dto.emergency === true,
          note: dto.note ?? null,
        },
        user.userId,
      );
    }

    return saved;
  }

  async rescheduleLessonAsLearner(
    user: AuthenticatedRequestUser,
    lessonId: string,
    dto: RescheduleLessonDto,
  ) {
    this.requireRole(user, 'learner');

    return this.lessonsRepo.manager.transaction(async (manager) => {
      const lessonRepo = manager.getRepository(LessonEntity);
      const slotRepo = manager.getRepository(InstructorAvailabilityEntity);
      const auditRepo = manager.getRepository(AuditLog);

      const lesson = await lessonRepo
        .createQueryBuilder('l')
        .setLock('pessimistic_write')
        .where('l.id = :lessonId', { lessonId })
        .andWhere('l.deleted_at IS NULL')
        .getOne();

      if (!lesson) {
        throw new NotFoundException('Lesson not found');
      }
      if (lesson.learnerUserId !== user.userId) {
        throw new ForbiddenException('Only the learner can reschedule this lesson');
      }
      if (!this.canLearnerManageLesson(lesson.status)) {
        throw new BadRequestException(`Cannot reschedule a lesson in ${lesson.status} state`);
      }

      const window = this.resolveLearnerPolicyWindow(lesson.scheduledAt);
      const previousStatus = lesson.status;
      const previousScheduledAt = lesson.scheduledAt ? lesson.scheduledAt.toISOString() : null;
      const previousDurationMinutes = lesson.durationMinutes ?? null;
      const previousAvailabilitySlotId = lesson.availabilitySlotId;
      if (window === 'under_24h' && !dto.emergency) {
        throw new BadRequestException(
          'Rescheduling within 24 hours requires instructor approval or emergency verification',
        );
      }

      const targetSlot = await slotRepo
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.id = :slotId', { slotId: dto.availabilitySlotId })
        .andWhere('s.deleted_at IS NULL')
        .getOne();

      if (!targetSlot) {
        throw new NotFoundException('Availability slot not found');
      }
      if (targetSlot.status !== 'open' || targetSlot.bookedLessonId) {
        throw new BadRequestException('This time slot is no longer available');
      }
      if (targetSlot.instructorId !== lesson.instructorId) {
        throw new BadRequestException('Selected slot must belong to the same instructor');
      }

      const durationMinutes = this.diffMinutes(targetSlot.startsAt, targetSlot.endsAt);
      await this.ensureNoLessonConflicts(
        lesson.instructorId,
        targetSlot.startsAt,
        durationMinutes,
        lesson.id,
      );

      const previousSlotId = lesson.availabilitySlotId;
      lesson.scheduledAt = targetSlot.startsAt;
      lesson.durationMinutes = durationMinutes;
      lesson.availabilitySlotId = targetSlot.id;
      const savedLesson = await lessonRepo.save(lesson);

      targetSlot.status = 'booked';
      targetSlot.bookedLessonId = savedLesson.id;
      await slotRepo.save(targetSlot);

      if (previousSlotId && previousSlotId !== targetSlot.id) {
        const previousSlot = await slotRepo
          .createQueryBuilder('s')
          .setLock('pessimistic_write')
          .where('s.id = :slotId', { slotId: previousSlotId })
          .andWhere('s.deleted_at IS NULL')
          .getOne();
        if (previousSlot && previousSlot.bookedLessonId === savedLesson.id) {
          previousSlot.status = 'open';
          previousSlot.bookedLessonId = null;
          await slotRepo.save(previousSlot);
        }
      }

      const instructor = await this.instructorsRepo.findOne({ where: { id: savedLesson.instructorId } });
      if (instructor && !instructor.deletedAt) {
        await this.notificationsService.createForUser(
          instructor.userId,
          'booking_status',
          'Learner rescheduled booking',
          this.learnerRescheduleMessage(window, dto.emergency === true),
          {
            lessonId: savedLesson.id,
            instructorId: savedLesson.instructorId,
            learnerUserId: savedLesson.learnerUserId,
            availabilitySlotId: savedLesson.availabilitySlotId,
            scheduledAt: savedLesson.scheduledAt,
            durationMinutes: savedLesson.durationMinutes,
            policyWindow: window,
            emergency: dto.emergency === true,
            note: dto.note ?? null,
          },
          user.userId,
        );
      }

      await this.recordLessonAuditEvent(
        'LESSON_RESCHEDULED_BY_LEARNER',
        user.userId,
        savedLesson,
        {
          eventVersion: 1,
          actorRole: normaliseRole(user.role) ?? user.role ?? null,
          previousStatus,
          nextStatus: savedLesson.status,
          previousScheduledAt,
          previousDurationMinutes,
          previousAvailabilitySlotId,
          policyWindow: window,
          emergency: dto.emergency === true,
          note: dto.note ?? null,
        },
        auditRepo,
      );

      return savedLesson;
    });
  }

  async listMyLessons(user: AuthenticatedRequestUser) {
    const role = normaliseRole(user.role);
    if (!role) {
      throw new ForbiddenException('Role is required');
    }

    if (role === 'instructor') {
      const instructor = await this.findInstructorForUser(user.userId);
      if (!instructor) {
        return [];
      }
      const rows = await this.lessonsRepo
        .createQueryBuilder('l')
        .leftJoin('users', 'learner', 'learner.id = l.learner_user_id')
        .where('l.instructor_id = :instructorId', { instructorId: instructor.id })
        .andWhere('l.deleted_at IS NULL')
        .select('l.id', 'id')
        .addSelect('l.instructor_id', 'instructor_id')
        .addSelect('l.learner_user_id', 'learner_user_id')
        .addSelect('l.scheduled_at', 'scheduled_at')
        .addSelect('l.duration_minutes', 'duration_minutes')
        .addSelect('l.status', 'status')
        .addSelect('l.availability_slot_id', 'availability_slot_id')
        .addSelect('learner.name', 'learner_name')
        .orderBy('l.scheduled_at', 'ASC', 'NULLS LAST')
        .addOrderBy('l.created_at', 'DESC')
        .getRawMany<{
          id: string;
          instructor_id: string;
          learner_user_id: string;
          scheduled_at: Date | null;
          duration_minutes: number | null;
          status: LessonEntity['status'];
          availability_slot_id: string | null;
          learner_name: string | null;
        }>();

      return rows.map((row) => ({
        id: row.id,
        instructorId: row.instructor_id,
        learnerUserId: row.learner_user_id,
        scheduledAt: row.scheduled_at,
        durationMinutes: row.duration_minutes !== null ? Number(row.duration_minutes) : null,
        status: row.status,
        availabilitySlotId: row.availability_slot_id,
        learnerName: row.learner_name ?? 'Learner',
        instructorName: instructor.fullName,
      }));
    }

    if (role === 'learner') {
      const rows = await this.lessonsRepo
        .createQueryBuilder('l')
        .leftJoin('instructors', 'i', 'i.id = l.instructor_id')
        .leftJoin('users', 'learner', 'learner.id = l.learner_user_id')
        .where('l.learner_user_id = :learnerUserId', { learnerUserId: user.userId })
        .andWhere('l.deleted_at IS NULL')
        .select('l.id', 'id')
        .addSelect('l.instructor_id', 'instructor_id')
        .addSelect('l.learner_user_id', 'learner_user_id')
        .addSelect('l.scheduled_at', 'scheduled_at')
        .addSelect('l.duration_minutes', 'duration_minutes')
        .addSelect('l.status', 'status')
        .addSelect('l.availability_slot_id', 'availability_slot_id')
        .addSelect('i.full_name', 'instructor_name')
        .addSelect('learner.name', 'learner_name')
        .orderBy('l.scheduled_at', 'ASC', 'NULLS LAST')
        .addOrderBy('l.created_at', 'DESC')
        .getRawMany<{
          id: string;
          instructor_id: string;
          learner_user_id: string;
          scheduled_at: Date | null;
          duration_minutes: number | null;
          status: LessonEntity['status'];
          availability_slot_id: string | null;
          instructor_name: string | null;
          learner_name: string | null;
        }>();

      return rows.map((row) => ({
        id: row.id,
        instructorId: row.instructor_id,
        learnerUserId: row.learner_user_id,
        scheduledAt: row.scheduled_at,
        durationMinutes: row.duration_minutes !== null ? Number(row.duration_minutes) : null,
        status: row.status,
        availabilitySlotId: row.availability_slot_id,
        instructorName: row.instructor_name ?? 'Instructor',
        learnerName: row.learner_name ?? null,
      }));
    }

    throw new ForbiddenException('Unsupported role');
  }

  async createReview(
    user: AuthenticatedRequestUser,
    instructorId: string,
    dto: CreateReviewDto,
  ) {
    this.requireRole(user, 'learner');

    const instructor = await this.instructorsRepo.findOne({ where: { id: instructorId } });
    if (!instructor || instructor.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const reviewCount = await this.reviewsRepo
      .createQueryBuilder('r')
      .where('r.learner_user_id = :learnerUserId', { learnerUserId: user.userId })
      .andWhere('r.created_at >= :windowStart', { windowStart: twentyFourHoursAgo })
      .andWhere('r.deleted_at IS NULL')
      .getCount();

    if (reviewCount >= 3) {
      throw new BadRequestException('Review limit reached. Please try again later.');
    }

    const lesson = await this.lessonsRepo.findOne({ where: { id: dto.lessonId } });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.instructorId !== instructorId || lesson.learnerUserId !== user.userId) {
      throw new ForbiddenException('Lesson does not match this instructor or learner');
    }

    if (lesson.status !== 'completed') {
      throw new BadRequestException('You can only review completed lessons');
    }

    const existing = await this.reviewsRepo.findOne({
      where: {
        instructorId,
        learnerUserId: user.userId,
        lessonId: dto.lessonId,
      },
      withDeleted: true,
    });
    if (existing && !existing.deletedAt) {
      throw new BadRequestException('You have already reviewed this lesson');
    }

    const review = this.reviewsRepo.create({
      instructorId,
      learnerUserId: user.userId,
      lessonId: dto.lessonId,
      rating: dto.rating,
      reviewText: dto.reviewText ?? null,
      status: 'visible',
    });
    const savedReview = await this.reviewsRepo.save(review);
    await this.notificationsService.createForUser(
      instructor.userId,
      'lesson_update',
      'New learner review',
      `A learner left a ${dto.rating}-star review after a completed lesson.`,
      {
        reviewId: savedReview.id,
        lessonId: dto.lessonId,
        rating: dto.rating,
      },
      user.userId,
    );
    return savedReview;
  }

  private async createLessonFromAvailabilitySlot(
    user: AuthenticatedRequestUser,
    dto: CreateLessonDto,
  ) {
    return this.lessonsRepo.manager.transaction(async (manager) => {
      const slotRepo = manager.getRepository(InstructorAvailabilityEntity);
      const lessonRepo = manager.getRepository(LessonEntity);
      const instructorRepo = manager.getRepository(InstructorEntity);
      const auditRepo = manager.getRepository(AuditLog);

      const slot = await slotRepo
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.id = :slotId', { slotId: dto.availabilitySlotId })
        .andWhere('s.deleted_at IS NULL')
        .getOne();

      if (!slot) {
        throw new NotFoundException('Availability slot not found');
      }
      if (slot.status !== 'open' || slot.bookedLessonId) {
        throw new BadRequestException('This time slot is no longer available');
      }

      const instructor = await instructorRepo.findOne({ where: { id: slot.instructorId } });
      if (!instructor || instructor.deletedAt || !instructor.isApproved || instructor.suspendedAt) {
        throw new BadRequestException('Instructor is not available for lessons');
      }

      if (dto.instructorId && dto.instructorId !== slot.instructorId) {
        throw new BadRequestException('Instructor does not match selected time slot');
      }

      await this.ensureNoLessonConflicts(
        slot.instructorId,
        slot.startsAt,
        this.diffMinutes(slot.startsAt, slot.endsAt),
      );

      const lesson = lessonRepo.create({
        instructorId: slot.instructorId,
        learnerUserId: user.userId,
        scheduledAt: slot.startsAt,
        durationMinutes: this.diffMinutes(slot.startsAt, slot.endsAt),
        status: 'requested',
        learnerNote: dto.learnerNote ?? null,
        availabilitySlotId: slot.id,
      });

      const savedLesson = await lessonRepo.save(lesson);
      slot.status = 'booked';
      slot.bookedLessonId = savedLesson.id;
      await slotRepo.save(slot);
      await this.recordLessonAuditEvent(
        'LESSON_CREATED',
        user.userId,
        savedLesson,
        {
          eventVersion: 1,
          actorRole: normaliseRole(user.role) ?? user.role ?? null,
          source: 'availability_slot',
          requestedInstructorId: dto.instructorId ?? slot.instructorId,
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
        },
        auditRepo,
      );
      await this.notificationsService.createForUser(
        instructor.userId,
        'booking_request',
        'New lesson request',
        'A learner requested one of your published time slots.',
        {
          lessonId: savedLesson.id,
          availabilitySlotId: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          learnerUserId: user.userId,
        },
        user.userId,
      );
      return savedLesson;
    });
  }

  private async recordLessonAuditEvent(
    action: string,
    actorUserId: string | null,
    lesson: Pick<
      LessonEntity,
      'id' | 'instructorId' | 'learnerUserId' | 'scheduledAt' | 'durationMinutes' | 'status' | 'availabilitySlotId'
    >,
    metadata: Record<string, unknown>,
    auditRepo: Repository<AuditLog>,
  ) {
    await auditRepo.save({
      userId: actorUserId,
      action,
      metadata: {
        lessonId: lesson.id,
        instructorId: lesson.instructorId,
        learnerUserId: lesson.learnerUserId,
        scheduledAt: lesson.scheduledAt ? lesson.scheduledAt.toISOString() : null,
        durationMinutes: lesson.durationMinutes ?? null,
        status: lesson.status,
        availabilitySlotId: lesson.availabilitySlotId ?? null,
        ...metadata,
      },
    });
  }

  private async syncAvailabilitySlotForLessonStatus(lesson: LessonEntity) {
    if (!lesson.availabilitySlotId) return;
    const slot = await this.availabilityRepo.findOne({ where: { id: lesson.availabilitySlotId } });
    if (!slot || slot.deletedAt) return;

    if (lesson.status === 'declined' || lesson.status === 'cancelled') {
      slot.status = 'open';
      slot.bookedLessonId = null;
      await this.availabilityRepo.save(slot);
      return;
    }

    if (lesson.status === 'accepted' || lesson.status === 'completed') {
      slot.status = 'booked';
      slot.bookedLessonId = lesson.id;
      await this.availabilityRepo.save(slot);
    }
  }

  private async getInstructorForUser(userId: string) {
    const instructor = await this.findInstructorForUser(userId);
    if (!instructor) {
      throw new NotFoundException('Instructor profile not found');
    }
    return instructor;
  }

  private async findInstructorForUser(userId: string) {
    const instructor = await this.instructorsRepo.findOne({ where: { userId } });
    if (!instructor || instructor.deletedAt) {
      return null;
    }
    return instructor;
  }

  // Let instructor-role users publish a first slot without being blocked on the full profile form.
  private async getOrBootstrapInstructorForUser(userId: string) {
    const existing = await this.findInstructorForUser(userId);
    if (existing) {
      return existing;
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('Instructor profile not found');
    }

    const fallbackEmail = `pending+${userId.replace(/-/g, '').slice(0, 12)}@drivest.invalid`;
    const profile = this.instructorsRepo.create({
      userId,
      fullName: this.defaultInstructorName(user),
      email: user.email?.trim() || fallbackEmail,
      phone: user.phone ?? null,
      adiNumber: this.temporaryAdiNumber(userId),
      profilePhotoUrl: null,
      yearsExperience: null,
      transmissionType: 'both',
      hourlyRatePence: null,
      bio: null,
      languages: null,
      coveragePostcodes: null,
      homeLocation: null,
      isApproved: false,
      approvedAt: null,
      suspendedAt: null,
    });

    return this.instructorsRepo.save(profile);
  }

  private defaultInstructorName(user: User): string {
    const name = user.name?.trim();
    if (name) {
      return name;
    }
    const email = user.email?.trim();
    if (email) {
      const localPart = email.split('@')[0]?.trim();
      if (localPart) {
        return localPart;
      }
    }
    return 'Instructor';
  }

  private temporaryAdiNumber(userId: string): string {
    const compact = userId.replace(/-/g, '').toUpperCase();
    return `TMP${compact.slice(0, 12)}`;
  }

  private normaliseCoverageAreas(raw?: string[] | null): string[] | null {
    if (!raw) {
      return null;
    }

    const cleaned = raw
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => value.toUpperCase());

    if (cleaned.length === 0) {
      return null;
    }

    return Array.from(new Set(cleaned));
  }

  private validateSlotWindow(startsAt: Date, endsAt: Date) {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Invalid slot date');
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException('Slot end time must be after start time');
    }
    if ((endsAt.getTime() - startsAt.getTime()) / 60000 > 600) {
      throw new BadRequestException('Slot duration is too long');
    }
  }

  private async ensureNoAvailabilityOverlap(
    instructorId: string,
    startsAt: Date,
    endsAt: Date,
    ignoreSlotId?: string,
  ) {
    const qb = this.availabilityRepo
      .createQueryBuilder('s')
      .where('s.instructor_id = :instructorId', { instructorId })
      .andWhere('s.deleted_at IS NULL')
      .andWhere("s.status IN ('open', 'booked')")
      .andWhere('s.starts_at < :endsAt', { endsAt })
      .andWhere('s.ends_at > :startsAt', { startsAt });

    if (ignoreSlotId) {
      qb.andWhere('s.id != :ignoreSlotId', { ignoreSlotId });
    }

    const overlap = await qb.getOne();
    if (overlap) {
      throw new BadRequestException('Availability conflicts with an existing slot');
    }
  }

  private async ensureNoLessonConflicts(
    instructorId: string,
    startsAt: Date,
    durationMinutes: number,
    ignoreLessonId?: string,
  ) {
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    const qb = this.lessonsRepo
      .createQueryBuilder('l')
      .where('l.instructor_id = :instructorId', { instructorId })
      .andWhere('l.deleted_at IS NULL')
      .andWhere("l.status IN ('requested', 'accepted', 'completed')")
      .andWhere('l.scheduled_at IS NOT NULL')
      .andWhere('l.duration_minutes IS NOT NULL')
      .andWhere('l.scheduled_at < :endsAt', { endsAt })
      .andWhere("(l.scheduled_at + (l.duration_minutes || ' minutes')::interval) > :startsAt", {
        startsAt,
      });

    if (ignoreLessonId) {
      qb.andWhere('l.id != :ignoreLessonId', { ignoreLessonId });
    }

    const clash = await qb.getOne();
    if (clash) {
      throw new BadRequestException('Booking conflicts with another lesson');
    }
  }

  private canLearnerManageLesson(status: LessonEntity['status']) {
    return status === 'requested' || status === 'accepted' || status === 'planned';
  }

  private resolveLearnerPolicyWindow(
    scheduledAt: Date | null,
  ): 'unscheduled' | 'over_48h' | 'between_24h_48h' | 'under_24h' {
    if (!scheduledAt) {
      return 'unscheduled';
    }
    const hoursUntilStart = (scheduledAt.getTime() - Date.now()) / 3_600_000;
    if (hoursUntilStart >= 48) {
      return 'over_48h';
    }
    if (hoursUntilStart >= 24) {
      return 'between_24h_48h';
    }
    return 'under_24h';
  }

  private learnerCancellationMessage(
    window: 'unscheduled' | 'over_48h' | 'between_24h_48h' | 'under_24h',
    isEmergency: boolean,
  ) {
    switch (window) {
      case 'over_48h':
      case 'unscheduled':
        return 'Learner cancelled this booking more than 48 hours before start.';
      case 'between_24h_48h':
        return 'Learner cancelled within 24-48 hours. Partial charge or credit policy may apply.';
      case 'under_24h':
        return isEmergency
          ? 'Learner cancelled within 24 hours with emergency flag. Manual review may apply.'
          : 'Learner cancelled within 24 hours.';
      default:
        return 'Learner cancelled this booking.';
    }
  }

  private learnerRescheduleMessage(
    window: 'unscheduled' | 'over_48h' | 'between_24h_48h' | 'under_24h',
    isEmergency: boolean,
  ) {
    switch (window) {
      case 'over_48h':
      case 'unscheduled':
        return 'Learner rescheduled this booking.';
      case 'between_24h_48h':
        return 'Learner rescheduled within 24-48 hours.';
      case 'under_24h':
        return isEmergency
          ? 'Learner rescheduled within 24 hours with emergency flag. Manual review may apply.'
          : 'Learner rescheduled within 24 hours.';
      default:
        return 'Learner rescheduled this booking.';
    }
  }

  private resolveMonthWindow(month?: string) {
    if (!month) {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      const monthEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0),
      );
      return { monthStart, monthEnd };
    }

    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    if (
      Number.isNaN(year) ||
      Number.isNaN(monthNumber) ||
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      throw new BadRequestException('Invalid month format. Use YYYY-MM');
    }
    const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0));
    return { monthStart, monthEnd };
  }

  private diffMinutes(startsAt: Date, endsAt: Date): number {
    return Math.max(15, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));
  }

  private requireRole(user: AuthenticatedRequestUser, expectedRole: 'learner' | 'instructor') {
    const resolvedRole = normaliseRole(user.role);
    if (resolvedRole !== expectedRole) {
      throw new ForbiddenException(`Only ${expectedRole}s can perform this action`);
    }
  }

  private toPoint(
    lat: number | null | undefined,
    lng: number | null | undefined,
  ): { type: 'Point'; coordinates: [number, number] } | null {
    if (lat === undefined && lng === undefined) {
      return null;
    }
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {
      return null;
    }
    return { type: 'Point', coordinates: [lng, lat] };
  }
}
