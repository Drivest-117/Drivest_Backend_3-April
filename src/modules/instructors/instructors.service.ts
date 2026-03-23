import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import axios from 'axios';
import { InstructorEntity } from './entities/instructor.entity';
import { InstructorReviewEntity } from './entities/instructor-review.entity';
import { LessonEntity } from './entities/lesson.entity';
import { InstructorAvailabilityEntity } from './entities/instructor-availability.entity';
import { LessonPaymentEntity } from './entities/lesson-payment.entity';
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
import { ConfirmLessonStripePaymentDto } from './dto/confirm-lesson-stripe-payment.dto';
import { ActivateLessonApplePaymentDto } from './dto/activate-lesson-apple-payment.dto';
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
    @InjectRepository(LessonPaymentEntity)
    private readonly lessonPaymentsRepo: Repository<LessonPaymentEntity>,
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
    this.validateBankDetailsInput(
      dto.bankAccountHolderName,
      dto.bankSortCode,
      dto.bankAccountNumber,
    );

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
      bankAccountHolderName: this.normaliseOptionalText(dto.bankAccountHolderName),
      bankSortCode: this.normaliseBankSortCode(dto.bankSortCode),
      bankAccountNumber: this.normaliseBankAccountNumber(dto.bankAccountNumber),
      bankName: this.normaliseOptionalText(dto.bankName),
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
    this.validateBankDetailsInput(
      dto.bankAccountHolderName,
      dto.bankSortCode,
      dto.bankAccountNumber,
    );

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
      bankAccountHolderName:
        dto.bankAccountHolderName !== undefined
          ? this.normaliseOptionalText(dto.bankAccountHolderName)
          : profile.bankAccountHolderName,
      bankSortCode:
        dto.bankSortCode !== undefined
          ? this.normaliseBankSortCode(dto.bankSortCode)
          : profile.bankSortCode,
      bankAccountNumber:
        dto.bankAccountNumber !== undefined
          ? this.normaliseBankAccountNumber(dto.bankAccountNumber)
          : profile.bankAccountNumber,
      bankName:
        dto.bankName !== undefined ? this.normaliseOptionalText(dto.bankName) : profile.bankName,
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
      bankAccountHolderName: profile.bankAccountHolderName,
      bankSortCode: profile.bankSortCode,
      bankAccountNumber: profile.bankAccountNumber,
      bankName: profile.bankName,
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

  async listPublicLocationSuggestions(query: string, limit = 8) {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return [];
    }

    const normalizedLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
    const [localSuggestions, mapboxSuggestions] = await Promise.all([
      this.listCoverageSuggestionsFromProfiles(trimmedQuery, normalizedLimit),
      this.listMapboxLocationSuggestions(trimmedQuery, normalizedLimit),
    ]);

    return this.mergeLocationSuggestions(
      [...mapboxSuggestions, ...localSuggestions],
      normalizedLimit,
    );
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

  async listAdminInstructors(scope?: string) {
    const normalizedScope = (scope ?? 'all').trim().toLowerCase();
    const qb = this.instructorsRepo
      .createQueryBuilder('i')
      .where('i.deleted_at IS NULL');

    switch (normalizedScope) {
      case 'pending':
        qb.andWhere('i.is_approved = false').andWhere('i.suspended_at IS NULL');
        break;
      case 'approved':
        qb.andWhere('i.is_approved = true').andWhere('i.suspended_at IS NULL');
        break;
      case 'suspended':
        qb.andWhere('i.suspended_at IS NOT NULL');
        break;
      case 'all':
      default:
        break;
    }

    const profiles = await qb.orderBy('i.created_at', 'DESC').getMany();
    return profiles.map((profile) => this.mapAdminInstructorProfile(profile));
  }

  async getAdminInstructorProfile(instructorId: string) {
    const profile = await this.instructorsRepo.findOne({ where: { id: instructorId } });
    if (!profile || profile.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }
    return this.mapAdminInstructorProfile(profile);
  }

  async getPendingProfiles() {
    const profiles = await this.instructorsRepo.find({
      where: { isApproved: false, suspendedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return profiles.map((profile) => this.mapAdminInstructorProfile(profile));
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

    const learner = await this.usersRepo.findOne({
      where: { id: user.userId },
      select: ['id', 'phone'],
    });
    const pickupContactNumber = this.resolvePickupContactNumber(
      dto.pickup?.contactNumber,
      learner?.phone ?? null,
    );

    const lesson = this.lessonsRepo.create({
      instructorId: dto.instructorId,
      learnerUserId: user.userId,
      scheduledAt,
      durationMinutes,
      status: 'requested',
      learnerNote: dto.learnerNote ?? null,
      availabilitySlotId: null,
      pickupAddress: this.normaliseOptionalText(dto.pickup?.address),
      pickupPostcode: this.normaliseOptionalText(dto.pickup?.postcode),
      pickupLat: dto.pickup?.lat ?? null,
      pickupLng: dto.pickup?.lng ?? null,
      pickupPlaceId: this.normaliseOptionalText(dto.pickup?.placeId),
      pickupNote: this.normaliseOptionalText(dto.pickup?.note),
      pickupContactNumber,
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
        .addSelect('l.pickup_address', 'pickup_address')
        .addSelect('l.pickup_postcode', 'pickup_postcode')
        .addSelect('l.pickup_lat', 'pickup_lat')
        .addSelect('l.pickup_lng', 'pickup_lng')
        .addSelect('l.pickup_place_id', 'pickup_place_id')
        .addSelect('l.pickup_note', 'pickup_note')
        .addSelect('l.pickup_contact_number', 'pickup_contact_number')
        .addSelect('learner.name', 'learner_name')
        .addSelect('learner.email', 'learner_email')
        .addSelect('learner.phone', 'learner_phone')
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
          pickup_address: string | null;
          pickup_postcode: string | null;
          pickup_lat: number | null;
          pickup_lng: number | null;
          pickup_place_id: string | null;
          pickup_note: string | null;
          pickup_contact_number: string | null;
          learner_name: string | null;
          learner_email: string | null;
          learner_phone: string | null;
        }>();

      return rows.map((row) => ({
        id: row.id,
        instructorId: row.instructor_id,
        learnerUserId: row.learner_user_id,
        scheduledAt: row.scheduled_at,
        durationMinutes: row.duration_minutes !== null ? Number(row.duration_minutes) : null,
        status: row.status,
        availabilitySlotId: row.availability_slot_id,
        pickupAddress: row.pickup_address,
        pickupPostcode: row.pickup_postcode,
        pickupLat: row.pickup_lat !== null ? Number(row.pickup_lat) : null,
        pickupLng: row.pickup_lng !== null ? Number(row.pickup_lng) : null,
        pickupPlaceId: row.pickup_place_id,
        pickupNote: row.pickup_note,
        pickupContactNumber: row.pickup_contact_number,
        learnerName: row.learner_name ?? 'Learner',
        learnerEmail: row.learner_email ?? null,
        learnerPhone: row.learner_phone ?? null,
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
        .addSelect('l.pickup_address', 'pickup_address')
        .addSelect('l.pickup_postcode', 'pickup_postcode')
        .addSelect('l.pickup_lat', 'pickup_lat')
        .addSelect('l.pickup_lng', 'pickup_lng')
        .addSelect('l.pickup_place_id', 'pickup_place_id')
        .addSelect('l.pickup_note', 'pickup_note')
        .addSelect('l.pickup_contact_number', 'pickup_contact_number')
        .addSelect('i.full_name', 'instructor_name')
        .addSelect('learner.name', 'learner_name')
        .addSelect('learner.email', 'learner_email')
        .addSelect('learner.phone', 'learner_phone')
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
          pickup_address: string | null;
          pickup_postcode: string | null;
          pickup_lat: number | null;
          pickup_lng: number | null;
          pickup_place_id: string | null;
          pickup_note: string | null;
          pickup_contact_number: string | null;
          instructor_name: string | null;
          learner_name: string | null;
          learner_email: string | null;
          learner_phone: string | null;
        }>();

      return rows.map((row) => ({
        id: row.id,
        instructorId: row.instructor_id,
        learnerUserId: row.learner_user_id,
        scheduledAt: row.scheduled_at,
        durationMinutes: row.duration_minutes !== null ? Number(row.duration_minutes) : null,
        status: row.status,
        availabilitySlotId: row.availability_slot_id,
        pickupAddress: row.pickup_address,
        pickupPostcode: row.pickup_postcode,
        pickupLat: row.pickup_lat !== null ? Number(row.pickup_lat) : null,
        pickupLng: row.pickup_lng !== null ? Number(row.pickup_lng) : null,
        pickupPlaceId: row.pickup_place_id,
        pickupNote: row.pickup_note,
        pickupContactNumber: row.pickup_contact_number,
        instructorName: row.instructor_name ?? 'Instructor',
        learnerName: row.learner_name ?? null,
        learnerEmail: row.learner_email ?? null,
        learnerPhone: row.learner_phone ?? null,
      }));
    }

    throw new ForbiddenException('Unsupported role');
  }

  async createLessonStripeCheckout(user: AuthenticatedRequestUser, lessonId: string) {
    this.requireRole(user, 'learner');
    const { lesson, instructor } = await this.loadLearnerLessonContext(user.userId, lessonId);
    if (!['requested', 'accepted', 'planned'].includes(lesson.status)) {
      throw new BadRequestException(
        `Lesson payment can only be started for requested, accepted, or planned lessons`,
      );
    }
    const amountPence = this.resolveLessonAmountPence(lesson, instructor);
    const stripeSecret = this.requireStripeSecretKey();

    const existingPayment = await this.lessonPaymentsRepo.findOne({ where: { lessonId } });
    if (existingPayment?.status === 'captured') {
      return {
        lessonId,
        paymentStatus: 'captured',
        checkoutSessionId: existingPayment.checkoutSessionId,
        checkoutUrl: existingPayment.checkoutUrl,
        payment: this.mapLessonPayment(existingPayment),
      };
    }
    if (
      existingPayment?.provider === 'stripe' &&
      existingPayment.status === 'checkout_created' &&
      existingPayment.checkoutSessionId &&
      existingPayment.checkoutUrl
    ) {
      return {
        lessonId,
        paymentStatus: 'pending',
        checkoutSessionId: existingPayment.checkoutSessionId,
        checkoutUrl: existingPayment.checkoutUrl,
        payment: this.mapLessonPayment(existingPayment),
      };
    }

    const successUrl =
      process.env.STRIPE_LESSON_CHECKOUT_SUCCESS_URL ??
      process.env.STRIPE_CHECKOUT_SUCCESS_URL ??
      'drivest://lesson-payment/success?session_id={CHECKOUT_SESSION_ID}';
    const cancelUrl =
      process.env.STRIPE_LESSON_CHECKOUT_CANCEL_URL ??
      process.env.STRIPE_CHECKOUT_CANCEL_URL ??
      'drivest://lesson-payment/cancel';

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', successUrl);
    params.set('cancel_url', cancelUrl);
    params.set('payment_method_types[0]', 'card');
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'gbp');
    params.set('line_items[0][price_data][unit_amount]', String(amountPence));
    params.set(
      'line_items[0][price_data][product_data][name]',
      `Driving lesson with ${instructor.fullName}`,
    );
    params.set('metadata[lesson_id]', lesson.id);
    params.set('metadata[instructor_id]', instructor.id);
    params.set('metadata[learner_user_id]', lesson.learnerUserId);
    params.set('client_reference_id', lesson.id);

    const stripeCheckout = await this.postStripeForm('/checkout/sessions', params, stripeSecret);
    const isCaptured = String(stripeCheckout?.payment_status ?? '').toLowerCase() === 'paid';
    const checkoutSessionId = this.readString(stripeCheckout?.id);
    if (!checkoutSessionId) {
      throw new BadRequestException('Stripe checkout session was created without a session id');
    }

    const payment = existingPayment ?? this.lessonPaymentsRepo.create({ lessonId });
    payment.provider = 'stripe';
    payment.status = isCaptured ? 'captured' : 'checkout_created';
    payment.currencyCode = 'GBP';
    payment.amountPence = amountPence;
    payment.checkoutSessionId = checkoutSessionId;
    payment.checkoutUrl = this.normaliseOptionalText(this.readString(stripeCheckout?.url));
    payment.paymentIntentId = this.normaliseOptionalText(
      this.readString(stripeCheckout?.payment_intent),
    );
    payment.failureReason = null;
    payment.productId = null;
    payment.transactionId = null;
    payment.capturedAt = isCaptured ? new Date() : null;
    payment.rawProviderPayload = stripeCheckout ?? null;
    const savedPayment = await this.lessonPaymentsRepo.save(payment);

    await this.auditRepo.save({
      userId: user.userId,
      action: 'LESSON_PAYMENT_STRIPE_CHECKOUT_CREATED',
      metadata: {
        lessonId: lesson.id,
        amountPence,
        checkoutSessionId: savedPayment.checkoutSessionId,
        status: savedPayment.status,
      },
    });

    return {
      lessonId,
      paymentStatus: savedPayment.status === 'captured' ? 'captured' : 'pending',
      checkoutSessionId: savedPayment.checkoutSessionId,
      checkoutUrl: savedPayment.checkoutUrl,
      payment: this.mapLessonPayment(savedPayment),
    };
  }

  async confirmLessonStripePayment(
    user: AuthenticatedRequestUser,
    lessonId: string,
    dto: ConfirmLessonStripePaymentDto,
  ) {
    this.requireRole(user, 'learner');
    const { lesson, instructor } = await this.loadLearnerLessonContext(user.userId, lessonId);
    const stripeSecret = this.requireStripeSecretKey();

    const payment = await this.lessonPaymentsRepo.findOne({ where: { lessonId } });
    if (
      payment?.checkoutSessionId &&
      payment.checkoutSessionId !== dto.checkoutSessionId &&
      payment.provider === 'stripe'
    ) {
      throw new BadRequestException('Checkout session does not match the stored payment session');
    }

    const stripeCheckout = await this.getStripe(
      `/checkout/sessions/${encodeURIComponent(dto.checkoutSessionId)}`,
      stripeSecret,
    );
    const paymentStatusRaw = String(stripeCheckout?.payment_status ?? '').toLowerCase();
    const isCaptured = paymentStatusRaw === 'paid';
    const amountPence = this.resolveLessonAmountPence(lesson, instructor);

    const upsert = payment ?? this.lessonPaymentsRepo.create({ lessonId });
    upsert.provider = 'stripe';
    upsert.status = isCaptured ? 'captured' : 'pending';
    upsert.currencyCode = 'GBP';
    upsert.amountPence = amountPence;
    upsert.checkoutSessionId = dto.checkoutSessionId;
    upsert.checkoutUrl = this.normaliseOptionalText(this.readString(stripeCheckout?.url));
    upsert.paymentIntentId = this.normaliseOptionalText(
      this.readString(stripeCheckout?.payment_intent),
    );
    upsert.rawProviderPayload = stripeCheckout ?? null;
    upsert.failureReason = isCaptured ? null : 'Stripe payment not yet paid';
    upsert.capturedAt = isCaptured ? new Date() : null;
    const savedPayment = await this.lessonPaymentsRepo.save(upsert);

    await this.auditRepo.save({
      userId: user.userId,
      action: 'LESSON_PAYMENT_STRIPE_CONFIRMED',
      metadata: {
        lessonId,
        checkoutSessionId: dto.checkoutSessionId,
        status: savedPayment.status,
      },
    });

    return {
      lessonId,
      payment: this.mapLessonPayment(savedPayment),
    };
  }

  async activateLessonApplePayment(
    user: AuthenticatedRequestUser,
    lessonId: string,
    dto: ActivateLessonApplePaymentDto,
  ) {
    this.requireRole(user, 'learner');
    const { lesson, instructor } = await this.loadLearnerLessonContext(user.userId, lessonId);
    const amountPence = this.resolveLessonAmountPence(lesson, instructor);

    const existing = await this.lessonPaymentsRepo.findOne({ where: { lessonId } });
    if (existing?.provider === 'stripe' && existing.status === 'captured') {
      throw new BadRequestException('Stripe payment already captured for this lesson');
    }

    const payment = existing ?? this.lessonPaymentsRepo.create({ lessonId });
    payment.provider = 'apple_iap';
    payment.status = 'captured';
    payment.currencyCode = 'GBP';
    payment.amountPence = amountPence;
    payment.checkoutSessionId = null;
    payment.checkoutUrl = null;
    payment.paymentIntentId = null;
    payment.productId = dto.productId;
    payment.transactionId = dto.transactionId;
    payment.capturedAt = dto.purchasedAt ? new Date(dto.purchasedAt) : new Date();
    payment.failureReason = null;
    payment.rawProviderPayload = {
      originalTransactionId: dto.originalTransactionId ?? null,
      purchasedAt: dto.purchasedAt ?? null,
      environment: dto.environment ?? null,
      isRestore: dto.isRestore ?? false,
    };
    const saved = await this.lessonPaymentsRepo.save(payment);

    await this.auditRepo.save({
      userId: user.userId,
      action: 'LESSON_PAYMENT_APPLE_ACTIVATED',
      metadata: {
        lessonId,
        productId: dto.productId,
        transactionId: dto.transactionId,
      },
    });

    return {
      lessonId,
      payment: this.mapLessonPayment(saved),
    };
  }

  async getLessonPayment(user: AuthenticatedRequestUser, lessonId: string) {
    const role = normaliseRole(user.role);
    if (!role) {
      throw new ForbiddenException('Role is required');
    }

    const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId } });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException('Lesson not found');
    }

    if (role === 'learner') {
      if (lesson.learnerUserId !== user.userId) {
        throw new ForbiddenException('Only lesson participants can view payment');
      }
    } else if (role === 'instructor') {
      const instructor = await this.findInstructorForUser(user.userId);
      if (!instructor || instructor.id !== lesson.instructorId) {
        throw new ForbiddenException('Only lesson participants can view payment');
      }
    }

    const payment = await this.lessonPaymentsRepo.findOne({ where: { lessonId } });
    return {
      lessonId,
      payment: payment ? this.mapLessonPayment(payment) : null,
    };
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

      const learner = await manager.getRepository(User).findOne({
        where: { id: user.userId },
        select: ['id', 'phone'],
      });
      const pickupContactNumber = this.resolvePickupContactNumber(
        dto.pickup?.contactNumber,
        learner?.phone ?? null,
      );

      const lesson = lessonRepo.create({
        instructorId: slot.instructorId,
        learnerUserId: user.userId,
        scheduledAt: slot.startsAt,
        durationMinutes: this.diffMinutes(slot.startsAt, slot.endsAt),
        status: 'requested',
        learnerNote: dto.learnerNote ?? null,
        availabilitySlotId: slot.id,
        pickupAddress: this.normaliseOptionalText(dto.pickup?.address),
        pickupPostcode: this.normaliseOptionalText(dto.pickup?.postcode),
        pickupLat: dto.pickup?.lat ?? null,
        pickupLng: dto.pickup?.lng ?? null,
        pickupPlaceId: this.normaliseOptionalText(dto.pickup?.placeId),
        pickupNote: this.normaliseOptionalText(dto.pickup?.note),
        pickupContactNumber,
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
      bankAccountHolderName: null,
      bankSortCode: null,
      bankAccountNumber: null,
      bankName: null,
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

  private async listCoverageSuggestionsFromProfiles(query: string, limit: number) {
    const containsQuery = `%${query}%`;
    const prefixQuery = `${query}%`;
    const rows = await this.instructorsRepo.query(
      `
        SELECT DISTINCT UPPER(TRIM(pc)) AS value
        FROM instructors i
        CROSS JOIN LATERAL unnest(i.coverage_postcodes) AS pc
        WHERE i.deleted_at IS NULL
          AND i.suspended_at IS NULL
          AND pc IS NOT NULL
          AND TRIM(pc) <> ''
          AND pc ILIKE $1
        ORDER BY
          CASE WHEN pc ILIKE $2 THEN 0 ELSE 1 END,
          LENGTH(TRIM(pc)) ASC
        LIMIT $3
      `,
      [containsQuery, prefixQuery, Math.min(limit * 3, 50)],
    );

    return rows.map((row: { value?: string | null }) => {
      const value = (row.value ?? '').trim().toUpperCase();
      return {
        value,
        kind: this.inferLocationSuggestionKind(value),
        source: 'instructor_coverage',
      };
    });
  }

  private async listMapboxLocationSuggestions(query: string, limit: number) {
    const mapboxToken = this.normaliseOptionalText(
      process.env.MAPBOX_ACCESS_TOKEN ??
        process.env.MAPBOX_API_TOKEN ??
        process.env.MAPBOX_PUBLIC_TOKEN,
    );
    if (!mapboxToken) {
      return [];
    }

    const encodedQuery = encodeURIComponent(query);
    const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json`;
    const params = new URLSearchParams({
      autocomplete: 'true',
      fuzzyMatch: 'true',
      types: 'postcode,place,locality,district,region',
      country: 'gb',
      limit: String(limit),
      language: 'en',
      access_token: mapboxToken,
    });

    try {
      const response = await axios.get<{ features?: Array<Record<string, unknown>> }>(
        `${endpoint}?${params.toString()}`,
        { timeout: 4500 },
      );
      const features = Array.isArray(response.data?.features) ? response.data.features : [];

      return features
        .map((feature) => {
          const placeTypes = Array.isArray(feature.place_type)
            ? feature.place_type.map((item) => String(item).toLowerCase())
            : [];
          const textValue = this.readString(feature.text);
          const placeNameValue = this.readString(feature.place_name);
          const derivedValue = placeTypes.includes('postcode')
            ? (textValue ?? placeNameValue ?? '').toUpperCase()
            : (textValue ?? placeNameValue ?? '');

          const value = derivedValue.trim();
          if (!value) {
            return null;
          }
          return {
            value,
            kind: placeTypes.includes('postcode') ? 'postcode' : 'city',
            source: 'mapbox',
          };
        })
        .filter(
          (
            suggestion,
          ): suggestion is { value: string; kind: 'postcode' | 'city'; source: 'mapbox' } =>
            suggestion !== null,
        );
    } catch {
      return [];
    }
  }

  private mergeLocationSuggestions(
    suggestions: Array<{ value: string; kind: string; source: string }>,
    limit: number,
  ) {
    const deduped = new Map<string, { value: string; kind: string; source: string }>();
    for (const suggestion of suggestions) {
      const value = suggestion.value.trim();
      if (!value) {
        continue;
      }
      const key = value.toUpperCase();
      if (!deduped.has(key)) {
        deduped.set(key, { ...suggestion, value });
      }
      if (deduped.size >= limit) {
        break;
      }
    }
    return Array.from(deduped.values()).slice(0, limit);
  }

  private inferLocationSuggestionKind(value: string): 'postcode' | 'city' {
    return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(value) ? 'postcode' : 'city';
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

  private normaliseOptionalText(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalisePhoneNumber(value?: string | null): string | null {
    const raw = this.normaliseOptionalText(value);
    if (!raw) {
      return null;
    }
    const withoutInvalidChars = raw.replace(/[^0-9+]/g, '');
    const normalized = withoutInvalidChars.startsWith('+')
      ? `+${withoutInvalidChars.slice(1).replace(/\+/g, '')}`
      : withoutInvalidChars.replace(/\+/g, '');
    const digits = normalized.replace(/[^0-9]/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return null;
    }
    return normalized;
  }

  private resolvePickupContactNumber(
    pickupContactNumber: string | undefined,
    learnerPhoneNumber: string | null,
  ): string | null {
    const explicit = this.normalisePhoneNumber(pickupContactNumber);
    if (explicit) {
      return explicit;
    }
    return this.normalisePhoneNumber(learnerPhoneNumber);
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private normaliseBankSortCode(value?: string | null): string | null {
    const cleaned = this.normaliseOptionalText(value);
    if (!cleaned) {
      return null;
    }
    return cleaned.replace(/[^0-9]/g, '');
  }

  private normaliseBankAccountNumber(value?: string | null): string | null {
    const cleaned = this.normaliseOptionalText(value);
    if (!cleaned) {
      return null;
    }
    return cleaned.replace(/[^0-9]/g, '');
  }

  private validateBankDetailsInput(
    holderName?: string | null,
    sortCode?: string | null,
    accountNumber?: string | null,
  ) {
    const normalizedHolder = this.normaliseOptionalText(holderName);
    const normalizedSortCode = this.normaliseBankSortCode(sortCode);
    const normalizedAccountNumber = this.normaliseBankAccountNumber(accountNumber);
    const anyProvided = Boolean(normalizedHolder || normalizedSortCode || normalizedAccountNumber);
    if (!anyProvided) {
      return;
    }
    if (!normalizedHolder) {
      throw new BadRequestException('Bank account holder name is required');
    }
    if (!normalizedSortCode || !/^\d{6}$/.test(normalizedSortCode)) {
      throw new BadRequestException('Bank sort code must contain exactly 6 digits');
    }
    if (!normalizedAccountNumber || !/^\d{8}$/.test(normalizedAccountNumber)) {
      throw new BadRequestException('Bank account number must contain exactly 8 digits');
    }
  }

  private async loadLearnerLessonContext(learnerUserId: string, lessonId: string) {
    const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId } });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.learnerUserId !== learnerUserId) {
      throw new ForbiddenException('Only the learner can manage lesson payment');
    }
    const instructor = await this.instructorsRepo.findOne({ where: { id: lesson.instructorId } });
    if (!instructor || instructor.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }
    return { lesson, instructor };
  }

  private resolveLessonAmountPence(lesson: LessonEntity, instructor: InstructorEntity): number {
    const hourlyRate = instructor.hourlyRatePence;
    if (!hourlyRate || hourlyRate <= 0) {
      throw new BadRequestException('Instructor hourly rate is missing for payment');
    }
    if (!lesson.durationMinutes || lesson.durationMinutes <= 0) {
      throw new BadRequestException('Lesson duration is missing for payment');
    }
    const amountPence = Math.round((hourlyRate * lesson.durationMinutes) / 60);
    if (!Number.isFinite(amountPence) || amountPence <= 0) {
      throw new BadRequestException('Unable to calculate lesson payment amount');
    }
    return amountPence;
  }

  private requireStripeSecretKey(): string {
    const key = this.normaliseOptionalText(process.env.STRIPE_SECRET_KEY);
    if (!key) {
      throw new ServiceUnavailableException('Stripe payment is not configured');
    }
    return key;
  }

  private async postStripeForm(path: string, params: URLSearchParams, secret: string) {
    try {
      const response = await axios.post(`https://api.stripe.com/v1${path}`, params.toString(), {
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return response.data as Record<string, unknown>;
    } catch (error) {
      throw this.toStripeError(error);
    }
  }

  private async getStripe(path: string, secret: string) {
    try {
      const response = await axios.get(`https://api.stripe.com/v1${path}`, {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });
      return response.data as Record<string, unknown>;
    } catch (error) {
      throw this.toStripeError(error);
    }
  }

  private toStripeError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status ?? 500;
      const stripeMessage =
        typeof error.response?.data?.error?.message === 'string'
          ? error.response?.data?.error?.message
          : error.message;
      if (statusCode >= 500) {
        return new InternalServerErrorException(`Stripe error: ${stripeMessage}`);
      }
      return new BadRequestException(`Stripe error: ${stripeMessage}`);
    }
    return new InternalServerErrorException('Stripe request failed');
  }

  private mapLessonPayment(payment: LessonPaymentEntity) {
    return {
      id: payment.id,
      status: payment.status,
      provider: payment.provider,
      productId: payment.productId,
      transactionId: payment.transactionId,
    };
  }

  private mapAdminInstructorProfile(profile: InstructorEntity) {
    const approvalStatus = profile.suspendedAt
      ? 'suspended'
      : profile.isApproved
      ? 'approved'
      : 'pending';

    return {
      id: profile.id,
      userId: profile.userId,
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
      bankAccountHolderName: profile.bankAccountHolderName,
      bankSortCode: profile.bankSortCode,
      bankAccountNumber: profile.bankAccountNumber,
      bankName: profile.bankName,
      isApproved: profile.isApproved,
      approvedAt: profile.approvedAt,
      suspendedAt: profile.suspendedAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      approvalStatus,
    };
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
