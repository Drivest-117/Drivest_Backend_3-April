import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, IsNull, Repository } from "typeorm";
import axios from "axios";
import { InstructorEntity } from "./entities/instructor.entity";
import {
  InstructorReviewEntity,
  InstructorReviewStatus,
} from "./entities/instructor-review.entity";
import { LessonEntity } from "./entities/lesson.entity";
import { InstructorAvailabilityEntity } from "./entities/instructor-availability.entity";
import { LessonPaymentEntity } from "./entities/lesson-payment.entity";
import {
  LessonFinanceBookingSource,
  LessonFinanceSnapshotEntity,
} from "./entities/lesson-finance-snapshot.entity";
import { User } from "../../entities/user.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { CreateInstructorProfileDto } from "./dto/create-instructor-profile.dto";
import { UpdateInstructorProfileDto } from "./dto/update-instructor-profile.dto";
import { ListInstructorsQueryDto } from "./dto/list-instructors-query.dto";
import { AuthenticatedRequestUser, normaliseRole } from "./instructors.types";
import { CreateLessonDto } from "./dto/create-lesson.dto";
import { UpdateLessonStatusDto } from "./dto/update-lesson-status.dto";
import { CancelLessonDto } from "./dto/cancel-lesson.dto";
import { RescheduleLessonDto } from "./dto/reschedule-lesson.dto";
import { CreateReviewDto } from "./dto/create-review.dto";
import { CreateAvailabilitySlotDto } from "./dto/create-availability-slot.dto";
import { ConfirmLessonStripePaymentDto } from "./dto/confirm-lesson-stripe-payment.dto";
import { ActivateLessonApplePaymentDto } from "./dto/activate-lesson-apple-payment.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { DisputeCaseEntity } from "../disputes/entities/dispute-case.entity";
import { AdminFinanceReportQueryDto } from "./dto/admin-finance-report-query.dto";
import { AdminFinanceRepairDto } from "./dto/admin-finance-repair.dto";
import { computeLessonFinance } from "./lesson-finance-calculator";
import { InstructorShareCodeEntity } from "./entities/instructor-share-code.entity";
import {
  InstructorLearnerLinkEntity,
  InstructorLearnerLinkStatus,
} from "./entities/instructor-learner-link.entity";
import { SubmitLearnerLinkRequestDto } from "./dto/submit-learner-link-request.dto";
import { ListAdminReviewsQueryDto } from "./dto/list-admin-reviews-query.dto";
import { ReportReviewDto } from "./dto/report-review.dto";

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
    @InjectRepository(LessonFinanceSnapshotEntity)
    private readonly lessonFinanceRepo: Repository<LessonFinanceSnapshotEntity>,
    @InjectRepository(InstructorAvailabilityEntity)
    private readonly availabilityRepo: Repository<InstructorAvailabilityEntity>,
    @InjectRepository(InstructorShareCodeEntity)
    private readonly instructorShareCodeRepo: Repository<InstructorShareCodeEntity>,
    @InjectRepository(InstructorLearnerLinkEntity)
    private readonly instructorLearnerLinksRepo: Repository<InstructorLearnerLinkEntity>,
    @InjectRepository(DisputeCaseEntity)
    private readonly disputesRepo: Repository<DisputeCaseEntity>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createProfile(
    user: AuthenticatedRequestUser,
    dto: CreateInstructorProfileDto,
  ) {
    this.requireRole(user, "instructor");

    const existing = await this.instructorsRepo.findOne({
      where: { userId: user.userId },
    });
    if (existing) {
      throw new BadRequestException("Instructor profile already exists");
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
      bankAccountHolderName: this.normaliseOptionalText(
        dto.bankAccountHolderName,
      ),
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

  async updateProfile(
    user: AuthenticatedRequestUser,
    dto: UpdateInstructorProfileDto,
  ) {
    this.requireRole(user, "instructor");

    const profile = await this.instructorsRepo.findOne({
      where: { userId: user.userId },
    });
    if (!profile) {
      throw new NotFoundException("Instructor profile not found");
    }
    this.validateBankDetailsInput(
      dto.bankAccountHolderName,
      dto.bankSortCode,
      dto.bankAccountNumber,
    );

    const adiChanged =
      typeof dto.adiNumber === "string" && dto.adiNumber !== profile.adiNumber;

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
        dto.bankName !== undefined
          ? this.normaliseOptionalText(dto.bankName)
          : profile.bankName,
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
    this.requireRole(user, "instructor");

    const profile = await this.instructorsRepo.findOne({
      where: { userId: user.userId },
    });
    if (!profile || profile.deletedAt) {
      throw new NotFoundException("Instructor profile not found");
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
      .createQueryBuilder("i")
      .leftJoin("instructor_rating_summaries", "rs", "rs.instructor_id = i.id")
      .where("i.deleted_at IS NULL")
      .andWhere("i.is_approved = true")
      .andWhere("i.suspended_at IS NULL");

    if (query.transmissionType) {
      qb.andWhere("i.transmission_type = :transmissionType", {
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

    const locationQuery = (
      query.location ??
      query.postcode ??
      query.city
    )?.trim();
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
      qb.andWhere("i.home_location IS NOT NULL")
        .andWhere(
          "ST_DWithin(i.home_location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)",
          {
            lng: query.lng,
            lat: query.lat,
            radius,
          },
        )
        .addSelect(
          "ST_Distance(i.home_location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)",
          "distance_meters",
        );
    } else {
      qb.addSelect("NULL::float", "distance_meters");
    }

    qb.addSelect("i.id", "id")
      .addSelect("i.full_name", "full_name")
      .addSelect("i.profile_photo_url", "profile_photo_url")
      .addSelect("i.hourly_rate_pence", "hourly_rate_pence")
      .addSelect("i.transmission_type", "transmission_type")
      .addSelect("i.languages", "languages")
      .addSelect("i.coverage_postcodes", "coverage_postcodes")
      .addSelect("COALESCE(rs.rating_avg, 0)", "rating_avg")
      .addSelect("COALESCE(rs.rating_count, 0)", "rating_count");

    if (query.minRating !== undefined) {
      qb.andWhere("COALESCE(rs.rating_avg, 0) >= :minRating", {
        minRating: query.minRating,
      });
    }

    const rows = await qb
      .orderBy("distance_meters", "ASC", "NULLS LAST")
      .addOrderBy("rating_avg", "DESC")
      .addOrderBy("rating_count", "DESC")
      .getRawMany();

    return rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      profilePhotoUrl: row.profile_photo_url,
      hourlyRatePence:
        row.hourly_rate_pence !== null ? Number(row.hourly_rate_pence) : null,
      transmissionType: row.transmission_type,
      languages: row.languages ?? [],
      distanceMeters:
        row.distance_meters !== null ? Number(row.distance_meters) : null,
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
      throw new NotFoundException("Instructor not found");
    }

    const summary = await this.reviewsRepo
      .createQueryBuilder("r")
      .select("COALESCE(AVG(r.rating), 0)", "rating_avg")
      .addSelect("COUNT(r.id)", "rating_count")
      .where("r.instructor_id = :instructorId", { instructorId })
      .andWhere("r.status = 'visible'")
      .andWhere("r.deleted_at IS NULL")
      .getRawOne<{ rating_avg: string; rating_count: string }>();

    const reviews = await this.reviewsRepo
      .createQueryBuilder("r")
      .where("r.instructor_id = :instructorId", { instructorId })
      .andWhere("r.status = 'visible'")
      .andWhere("r.deleted_at IS NULL")
      .orderBy("r.created_at", "DESC")
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
      throw new NotFoundException("Instructor not found");
    }

    const { monthStart, monthEnd } = this.resolveMonthWindow(month);
    const slots = await this.availabilityRepo
      .createQueryBuilder("s")
      .where("s.instructor_id = :instructorId", { instructorId })
      .andWhere("s.deleted_at IS NULL")
      .andWhere("s.status = 'open'")
      .andWhere("s.starts_at >= :monthStart", { monthStart })
      .andWhere("s.starts_at < :monthEnd", { monthEnd })
      .orderBy("s.starts_at", "ASC")
      .getMany();

    return slots.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: slot.status,
    }));
  }

  async listMyAvailability(user: AuthenticatedRequestUser, month?: string) {
    this.requireRole(user, "instructor");
    const instructor = await this.findInstructorForUser(user.userId);
    if (!instructor) {
      return [];
    }
    const { monthStart, monthEnd } = this.resolveMonthWindow(month);

    const slots = await this.availabilityRepo
      .createQueryBuilder("s")
      .where("s.instructor_id = :instructorId", { instructorId: instructor.id })
      .andWhere("s.deleted_at IS NULL")
      .andWhere("s.starts_at >= :monthStart", { monthStart })
      .andWhere("s.starts_at < :monthEnd", { monthEnd })
      .orderBy("s.starts_at", "ASC")
      .getMany();

    return slots.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: slot.status,
      bookedLessonId: slot.bookedLessonId,
    }));
  }

  async createAvailabilitySlot(
    user: AuthenticatedRequestUser,
    dto: CreateAvailabilitySlotDto,
  ) {
    this.requireRole(user, "instructor");
    const instructor = await this.getOrBootstrapInstructorForUser(user.userId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.validateSlotWindow(startsAt, endsAt);

    await this.ensureNoAvailabilityOverlap(instructor.id, startsAt, endsAt);

    const slot = this.availabilityRepo.create({
      instructorId: instructor.id,
      startsAt,
      endsAt,
      status: "open",
      bookedLessonId: null,
    });
    return this.availabilityRepo.save(slot);
  }

  async cancelAvailabilitySlot(user: AuthenticatedRequestUser, slotId: string) {
    this.requireRole(user, "instructor");
    const instructor = await this.getInstructorForUser(user.userId);
    const slot = await this.availabilityRepo.findOne({ where: { id: slotId } });
    if (!slot || slot.deletedAt) {
      throw new NotFoundException("Availability slot not found");
    }
    if (slot.instructorId !== instructor.id) {
      throw new ForbiddenException("You can only manage your own availability");
    }
    if (slot.bookedLessonId) {
      throw new BadRequestException("Booked slot cannot be cancelled");
    }
    slot.status = "cancelled";
    await this.availabilityRepo.save(slot);
    await this.availabilityRepo.softDelete(slot.id);
    return { success: true };
  }

  async getInstructorShareCode(user: AuthenticatedRequestUser) {
    this.requireRole(user, "instructor");
    const instructor = await this.getOrBootstrapInstructorForUser(user.userId);
    const now = new Date();
    let activeCode = await this.instructorShareCodeRepo
      .createQueryBuilder("code")
      .where("code.instructor_id = :instructorId", {
        instructorId: instructor.id,
      })
      .andWhere("code.is_active = true")
      .andWhere("(code.expires_at IS NULL OR code.expires_at > :now)", { now })
      .orderBy("code.updated_at", "DESC")
      .getOne();

    if (!activeCode) {
      activeCode = await this.createInstructorShareCode(instructor.id, now);
    }

    return {
      code: activeCode.code,
      isActive: activeCode.isActive,
      expiresAt: activeCode.expiresAt,
      updatedAt: activeCode.updatedAt,
    };
  }

  async regenerateInstructorShareCode(user: AuthenticatedRequestUser) {
    this.requireRole(user, "instructor");
    const instructor = await this.getOrBootstrapInstructorForUser(user.userId);
    const now = new Date();
    const code = await this.instructorShareCodeRepo.manager.transaction(
      async (manager) => {
        await manager
          .createQueryBuilder()
          .update(InstructorShareCodeEntity)
          .set({ isActive: false })
          .where("instructor_id = :instructorId", {
            instructorId: instructor.id,
          })
          .andWhere("is_active = true")
          .execute();
        return this.createInstructorShareCode(instructor.id, now, manager);
      },
    );

    return {
      code: code.code,
      isActive: code.isActive,
      expiresAt: code.expiresAt,
      updatedAt: code.updatedAt,
    };
  }

  async submitLearnerLinkRequest(
    user: AuthenticatedRequestUser,
    dto: SubmitLearnerLinkRequestDto,
  ) {
    this.requireRole(user, "learner");
    const now = new Date();
    const shareCode = await this.instructorShareCodeRepo
      .createQueryBuilder("code")
      .where("code.code = :code", { code: dto.code.trim() })
      .andWhere("code.is_active = true")
      .andWhere("(code.expires_at IS NULL OR code.expires_at > :now)", { now })
      .orderBy("code.updated_at", "DESC")
      .getOne();
    if (!shareCode) {
      throw new NotFoundException("Instructor code not found");
    }

    const instructor = await this.instructorsRepo.findOne({
      where: { id: shareCode.instructorId },
    });
    if (!instructor || instructor.deletedAt) {
      throw new NotFoundException("Instructor not found");
    }
    if (instructor.userId === user.userId) {
      throw new BadRequestException(
        "You cannot link yourself as your own instructor",
      );
    }

    let link = await this.instructorLearnerLinksRepo.findOne({
      where: { instructorId: instructor.id, learnerUserId: user.userId },
      relations: ["instructor", "learnerUser"],
    });
    if (!link) {
      link = this.instructorLearnerLinksRepo.create({
        instructorId: instructor.id,
        learnerUserId: user.userId,
        status: InstructorLearnerLinkStatus.PENDING,
        requestCode: shareCode.code,
        requestedAt: now,
        approvedAt: null,
      });
    } else {
      link.requestCode = shareCode.code;
      link.requestedAt = now;
      if (link.status !== InstructorLearnerLinkStatus.APPROVED) {
        link.status = InstructorLearnerLinkStatus.PENDING;
        link.approvedAt = null;
      }
    }
    const saved = await this.instructorLearnerLinksRepo.save(link);
    const hydrated = await this.instructorLearnerLinksRepo.findOne({
      where: { id: saved.id },
      relations: ["instructor", "learnerUser"],
    });
    if (!hydrated) {
      throw new InternalServerErrorException("Unable to load instructor link");
    }
    return this.mapInstructorLearnerLink(hydrated);
  }

  async listInstructorPendingLinkRequests(user: AuthenticatedRequestUser) {
    this.requireRole(user, "instructor");
    const instructor = await this.getOrBootstrapInstructorForUser(user.userId);
    const links = await this.instructorLearnerLinksRepo.find({
      where: {
        instructorId: instructor.id,
        status: InstructorLearnerLinkStatus.PENDING,
      },
      relations: ["instructor", "learnerUser"],
      order: { requestedAt: "ASC" },
    });
    return links.map((link) => this.mapInstructorLearnerLink(link));
  }

  async approveInstructorLinkRequest(
    user: AuthenticatedRequestUser,
    linkId: string,
  ) {
    this.requireRole(user, "instructor");
    const instructor = await this.getOrBootstrapInstructorForUser(user.userId);
    const link = await this.instructorLearnerLinksRepo.findOne({
      where: { id: linkId, instructorId: instructor.id },
      relations: ["instructor", "learnerUser"],
    });
    if (!link) {
      throw new NotFoundException("Instructor link request not found");
    }
    link.status = InstructorLearnerLinkStatus.APPROVED;
    link.approvedAt = new Date();
    const saved = await this.instructorLearnerLinksRepo.save(link);
    await this.notificationsService.createForUser(
      saved.learnerUserId,
      "app_update",
      "Instructor request approved",
      `${saved.instructor?.fullName ?? "Your instructor"} approved your instructor link request.`,
      { linkId: saved.id, instructorId: saved.instructorId },
    );
    return this.mapInstructorLearnerLink(saved);
  }

  async listInstructorLinkedLearners(user: AuthenticatedRequestUser) {
    this.requireRole(user, "instructor");
    const instructor = await this.getOrBootstrapInstructorForUser(user.userId);
    const links = await this.instructorLearnerLinksRepo.find({
      where: {
        instructorId: instructor.id,
        status: InstructorLearnerLinkStatus.APPROVED,
      },
      relations: ["instructor", "learnerUser"],
      order: { approvedAt: "DESC", requestedAt: "DESC" },
    });
    return links.map((link) => this.mapInstructorLearnerLink(link));
  }

  async listLearnerInstructorLinks(user: AuthenticatedRequestUser) {
    this.requireRole(user, "learner");
    const links = await this.instructorLearnerLinksRepo.find({
      where: { learnerUserId: user.userId },
      relations: ["instructor", "learnerUser"],
      order: { approvedAt: "DESC", requestedAt: "DESC" },
    });
    return links.map((link) => this.mapInstructorLearnerLink(link));
  }

  async listAdminInstructors(scope?: string) {
    const normalizedScope = (scope ?? "all").trim().toLowerCase();
    const qb = this.instructorsRepo
      .createQueryBuilder("i")
      .where("i.deleted_at IS NULL");

    switch (normalizedScope) {
      case "pending":
        qb.andWhere("i.is_approved = false").andWhere("i.suspended_at IS NULL");
        break;
      case "approved":
        qb.andWhere("i.is_approved = true").andWhere("i.suspended_at IS NULL");
        break;
      case "suspended":
        qb.andWhere("i.suspended_at IS NOT NULL");
        break;
      case "all":
      default:
        break;
    }

    const profiles = await qb.orderBy("i.created_at", "DESC").getMany();
    return profiles.map((profile) => this.mapAdminInstructorProfile(profile));
  }

  async getAdminInstructorProfile(instructorId: string) {
    const profile = await this.instructorsRepo.findOne({
      where: { id: instructorId },
    });
    if (!profile || profile.deletedAt) {
      throw new NotFoundException("Instructor not found");
    }
    return this.mapAdminInstructorProfile(profile);
  }

  async getPendingProfiles() {
    const profiles = await this.instructorsRepo.find({
      where: { isApproved: false, suspendedAt: IsNull() },
      order: { createdAt: "ASC" },
    });
    return profiles.map((profile) => this.mapAdminInstructorProfile(profile));
  }

  async approveInstructor(instructorId: string) {
    const profile = await this.instructorsRepo.findOne({
      where: { id: instructorId },
    });
    if (!profile || profile.deletedAt) {
      throw new NotFoundException("Instructor not found");
    }
    profile.isApproved = true;
    profile.approvedAt = new Date();
    profile.suspendedAt = null;
    const saved = await this.instructorsRepo.save(profile);
    await this.notificationsService.createForUser(
      profile.userId,
      "app_update",
      "Instructor profile approved",
      "Your instructor profile is now approved and visible to learners.",
      { instructorId: profile.id },
    );
    return saved;
  }

  async suspendInstructor(instructorId: string) {
    const profile = await this.instructorsRepo.findOne({
      where: { id: instructorId },
    });
    if (!profile || profile.deletedAt) {
      throw new NotFoundException("Instructor not found");
    }
    profile.suspendedAt = new Date();
    profile.isApproved = false;
    const saved = await this.instructorsRepo.save(profile);
    await this.notificationsService.createForUser(
      profile.userId,
      "app_update",
      "Instructor profile suspended",
      "Your instructor profile is suspended. Contact support for details.",
      { instructorId: profile.id },
    );
    return saved;
  }

  async createLesson(user: AuthenticatedRequestUser, dto: CreateLessonDto) {
    // Phase 1 decision: learner creates lesson requests, instructors later mark status.
    this.requireRole(user, "learner");
    if (dto.availabilitySlotId) {
      return this.createLessonFromAvailabilitySlot(user, dto);
    }

    const instructor = await this.instructorsRepo.findOne({
      where: { id: dto.instructorId },
    });
    if (!instructor || instructor.deletedAt) {
      throw new NotFoundException("Instructor not found");
    }
    if (!instructor.isApproved || instructor.suspendedAt) {
      throw new BadRequestException("Instructor is not available for lessons");
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const durationMinutes = dto.durationMinutes ?? null;
    if (scheduledAt && durationMinutes) {
      await this.ensureNoLessonConflicts(
        instructor.id,
        scheduledAt,
        durationMinutes,
      );
    }

    const learner = await this.usersRepo.findOne({
      where: { id: user.userId },
      select: ["id", "phone"],
    });
    const pickupContactNumber = this.resolvePickupContactNumber(
      dto.pickup?.contactNumber,
      learner?.phone ?? null,
    );

    const { lesson: savedLesson, finance } =
      await this.lessonsRepo.manager.transaction(async (manager) => {
        const lessonRepo = manager.getRepository(LessonEntity);
        const auditRepo = manager.getRepository(AuditLog);

        const lesson = lessonRepo.create({
          instructorId: dto.instructorId,
          learnerUserId: user.userId,
          scheduledAt,
          durationMinutes,
          status: "requested",
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
        const saved = await lessonRepo.save(lesson);
        const financeSnapshot =
          await this.refreshLessonFinanceSnapshotWithFallback(saved.id, {
            manager,
            reason: "lesson_created_direct",
            actorUserId: user.userId,
            bookingSource: "marketplace",
          });
        await this.recordLessonAuditEvent(
          "LESSON_CREATED",
          user.userId,
          saved,
          {
            eventVersion: 1,
            actorRole: normaliseRole(user.role) ?? user.role ?? null,
            source: "direct_request",
            requestedInstructorId: dto.instructorId,
          },
          auditRepo,
        );
        return { lesson: saved, finance: financeSnapshot };
      });
    await this.notificationsService.createForUser(
      instructor.userId,
      "booking_request",
      "New lesson request",
      "A learner has requested a booking with you.",
      {
        lessonId: savedLesson.id,
        instructorId: instructor.id,
        learnerUserId: user.userId,
        scheduledAt: savedLesson.scheduledAt,
        durationMinutes: savedLesson.durationMinutes,
      },
      user.userId,
    );
    return this.mapLessonWithFinance(savedLesson, finance);
  }

  async updateLessonStatus(
    user: AuthenticatedRequestUser,
    lessonId: string,
    dto: UpdateLessonStatusDto,
  ) {
    this.requireRole(user, "instructor");

    const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId } });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException("Lesson not found");
    }

    const instructor = await this.instructorsRepo.findOne({
      where: { id: lesson.instructorId },
    });
    if (!instructor || instructor.deletedAt) {
      throw new NotFoundException("Instructor not found");
    }
    if (instructor.userId !== user.userId) {
      throw new ForbiddenException(
        "Only the lesson instructor can update lesson status",
      );
    }

    const nextStatus = dto.status;
    const previousStatus = lesson.status;
    const validTransitions: Record<string, string[]> = {
      requested: ["accepted", "declined", "completed", "cancelled"],
      accepted: ["completed", "cancelled"],
      planned: ["completed", "cancelled"],
      completed: [],
      declined: [],
      cancelled: [],
    };
    const allowed = validTransitions[lesson.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot change lesson from ${lesson.status} to ${nextStatus}`,
      );
    }

    if (
      nextStatus === "accepted" &&
      lesson.scheduledAt &&
      lesson.durationMinutes &&
      lesson.status !== "accepted"
    ) {
      await this.ensureNoLessonConflicts(
        instructor.id,
        lesson.scheduledAt,
        lesson.durationMinutes,
        lesson.id,
      );
    }

    const { lesson: saved, finance } =
      await this.lessonsRepo.manager.transaction(async (manager) => {
        const lessonRepo = manager.getRepository(LessonEntity);
        const auditRepo = manager.getRepository(AuditLog);
        const lockedLesson = await this.loadLessonForUpdate(
          lessonRepo,
          lessonId,
        );
        if (!lockedLesson) {
          throw new NotFoundException("Lesson not found");
        }
        lockedLesson.status = nextStatus;
        const savedLesson = await lessonRepo.save(lockedLesson);
        await this.syncAvailabilitySlotForLessonStatus(savedLesson, manager);
        const financeSnapshot =
          await this.refreshLessonFinanceSnapshotWithFallback(savedLesson.id, {
            manager,
            reason: "lesson_status_updated",
            actorUserId: user.userId,
          });
        await this.recordLessonAuditEvent(
          "LESSON_STATUS_UPDATED",
          user.userId,
          savedLesson,
          {
            eventVersion: 1,
            actorRole: normaliseRole(user.role) ?? user.role ?? null,
            previousStatus,
            nextStatus,
          },
          auditRepo,
        );
        return { lesson: savedLesson, finance: financeSnapshot };
      });
    const learnerMessage =
      nextStatus === "cancelled"
        ? "Instructor cancelled this booking. Learner is eligible for full refund and rebooking support."
        : `Your booking is now ${nextStatus}.`;
    await this.notificationsService.createForUser(
      saved.learnerUserId,
      "booking_status",
      "Booking status updated",
      learnerMessage,
      {
        lessonId: saved.id,
        instructorId: saved.instructorId,
        status: nextStatus,
        availabilitySlotId: saved.availabilitySlotId,
      },
      user.userId,
    );
    if (nextStatus === "cancelled") {
      await this.notificationsService.createForUser(
        instructor.userId,
        "booking_status",
        "Instructor cancellation policy notice",
        "This cancellation may trigger learner protection and instructor-side penalties.",
        {
          lessonId: saved.id,
          instructorId: saved.instructorId,
          status: nextStatus,
        },
        user.userId,
      );
    }
    return this.mapLessonWithFinance(saved, finance);
  }

  async cancelLessonAsLearner(
    user: AuthenticatedRequestUser,
    lessonId: string,
    dto: CancelLessonDto,
  ) {
    this.requireRole(user, "learner");
    const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId } });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException("Lesson not found");
    }
    if (lesson.learnerUserId !== user.userId) {
      throw new ForbiddenException("Only the learner can cancel this lesson");
    }
    if (!this.canLearnerManageLesson(lesson.status)) {
      throw new BadRequestException(
        `Cannot cancel a lesson in ${lesson.status} state`,
      );
    }

    const window = this.resolveLearnerPolicyWindow(lesson.scheduledAt);
    const previousStatus = lesson.status;
    if (window === "under_24h" && !dto.emergency) {
      throw new BadRequestException(
        "Cancellations within 24 hours require emergency verification",
      );
    }

    const { lesson: saved, finance } =
      await this.lessonsRepo.manager.transaction(async (manager) => {
        const lessonRepo = manager.getRepository(LessonEntity);
        const auditRepo = manager.getRepository(AuditLog);
        const lockedLesson = await this.loadLessonForUpdate(
          lessonRepo,
          lessonId,
        );

        if (!lockedLesson) {
          throw new NotFoundException("Lesson not found");
        }
        lockedLesson.status = "cancelled";
        const savedLesson = await lessonRepo.save(lockedLesson);
        await this.syncAvailabilitySlotForLessonStatus(savedLesson, manager);
        const financeSnapshot =
          await this.refreshLessonFinanceSnapshotWithFallback(savedLesson.id, {
            manager,
            reason: "lesson_cancelled_by_learner",
            actorUserId: user.userId,
          });
        await this.recordLessonAuditEvent(
          "LESSON_CANCELLED_BY_LEARNER",
          user.userId,
          savedLesson,
          {
            eventVersion: 1,
            actorRole: normaliseRole(user.role) ?? user.role ?? null,
            previousStatus,
            nextStatus: "cancelled",
            policyWindow: window,
            emergency: dto.emergency === true,
            note: dto.note ?? null,
          },
          auditRepo,
        );
        return { lesson: savedLesson, finance: financeSnapshot };
      });

    const instructor = await this.instructorsRepo.findOne({
      where: { id: saved.instructorId },
    });
    if (instructor && !instructor.deletedAt) {
      await this.notificationsService.createForUser(
        instructor.userId,
        "booking_status",
        "Learner cancelled booking",
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

    return this.mapLessonWithFinance(saved, finance);
  }

  async rescheduleLessonAsLearner(
    user: AuthenticatedRequestUser,
    lessonId: string,
    dto: RescheduleLessonDto,
  ) {
    this.requireRole(user, "learner");

    return this.lessonsRepo.manager.transaction(async (manager) => {
      const lessonRepo = manager.getRepository(LessonEntity);
      const slotRepo = manager.getRepository(InstructorAvailabilityEntity);
      const auditRepo = manager.getRepository(AuditLog);

      const lesson = await lessonRepo
        .createQueryBuilder("l")
        .setLock("pessimistic_write")
        .where("l.id = :lessonId", { lessonId })
        .andWhere("l.deleted_at IS NULL")
        .getOne();

      if (!lesson) {
        throw new NotFoundException("Lesson not found");
      }
      if (lesson.learnerUserId !== user.userId) {
        throw new ForbiddenException(
          "Only the learner can reschedule this lesson",
        );
      }
      if (!this.canLearnerManageLesson(lesson.status)) {
        throw new BadRequestException(
          `Cannot reschedule a lesson in ${lesson.status} state`,
        );
      }

      const window = this.resolveLearnerPolicyWindow(lesson.scheduledAt);
      const previousStatus = lesson.status;
      const previousScheduledAt = lesson.scheduledAt
        ? lesson.scheduledAt.toISOString()
        : null;
      const previousDurationMinutes = lesson.durationMinutes ?? null;
      const previousAvailabilitySlotId = lesson.availabilitySlotId;
      if (window === "under_24h" && !dto.emergency) {
        throw new BadRequestException(
          "Rescheduling within 24 hours requires instructor approval or emergency verification",
        );
      }

      const targetSlot = await slotRepo
        .createQueryBuilder("s")
        .setLock("pessimistic_write")
        .where("s.id = :slotId", { slotId: dto.availabilitySlotId })
        .andWhere("s.deleted_at IS NULL")
        .getOne();

      if (!targetSlot) {
        throw new NotFoundException("Availability slot not found");
      }
      if (targetSlot.status !== "open" || targetSlot.bookedLessonId) {
        throw new BadRequestException("This time slot is no longer available");
      }
      if (targetSlot.instructorId !== lesson.instructorId) {
        throw new BadRequestException(
          "Selected slot must belong to the same instructor",
        );
      }

      const durationMinutes = this.diffMinutes(
        targetSlot.startsAt,
        targetSlot.endsAt,
      );
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

      targetSlot.status = "booked";
      targetSlot.bookedLessonId = savedLesson.id;
      await slotRepo.save(targetSlot);

      if (previousSlotId && previousSlotId !== targetSlot.id) {
        const previousSlot = await slotRepo
          .createQueryBuilder("s")
          .setLock("pessimistic_write")
          .where("s.id = :slotId", { slotId: previousSlotId })
          .andWhere("s.deleted_at IS NULL")
          .getOne();
        if (previousSlot && previousSlot.bookedLessonId === savedLesson.id) {
          previousSlot.status = "open";
          previousSlot.bookedLessonId = null;
          await slotRepo.save(previousSlot);
        }
      }

      const instructor = await this.instructorsRepo.findOne({
        where: { id: savedLesson.instructorId },
      });
      if (instructor && !instructor.deletedAt) {
        await this.notificationsService.createForUser(
          instructor.userId,
          "booking_status",
          "Learner rescheduled booking",
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

      const financeSnapshot =
        await this.refreshLessonFinanceSnapshotWithFallback(savedLesson.id, {
          manager,
          reason: "lesson_rescheduled_by_learner",
          actorUserId: user.userId,
        });

      await this.recordLessonAuditEvent(
        "LESSON_RESCHEDULED_BY_LEARNER",
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

      return this.mapLessonWithFinance(savedLesson, financeSnapshot);
    });
  }

  async listMyLessons(user: AuthenticatedRequestUser) {
    const role = normaliseRole(user.role);
    if (!role) {
      throw new ForbiddenException("Role is required");
    }

    if (role === "instructor") {
      const instructor = await this.findInstructorForUser(user.userId);
      if (!instructor) {
        return [];
      }
      const rows = await this.lessonsRepo
        .createQueryBuilder("l")
        .leftJoin("users", "learner", "learner.id = l.learner_user_id")
        .leftJoin("lesson_finance_snapshots", "fs", "fs.lesson_id = l.id")
        .where("l.instructor_id = :instructorId", {
          instructorId: instructor.id,
        })
        .andWhere("l.deleted_at IS NULL")
        .select("l.id", "id")
        .addSelect("l.instructor_id", "instructor_id")
        .addSelect("l.learner_user_id", "learner_user_id")
        .addSelect("l.scheduled_at", "scheduled_at")
        .addSelect("l.duration_minutes", "duration_minutes")
        .addSelect("l.status", "status")
        .addSelect("l.availability_slot_id", "availability_slot_id")
        .addSelect("l.pickup_address", "pickup_address")
        .addSelect("l.pickup_postcode", "pickup_postcode")
        .addSelect("l.pickup_lat", "pickup_lat")
        .addSelect("l.pickup_lng", "pickup_lng")
        .addSelect("l.pickup_place_id", "pickup_place_id")
        .addSelect("l.pickup_note", "pickup_note")
        .addSelect("l.pickup_contact_number", "pickup_contact_number")
        .addSelect("learner.name", "learner_name")
        .addSelect("learner.email", "learner_email")
        .addSelect("learner.phone", "learner_phone")
        .addSelect("fs.id", "finance_id")
        .addSelect("fs.booking_source", "finance_booking_source")
        .addSelect("fs.currency_code", "finance_currency_code")
        .addSelect("fs.gross_amount_pence", "finance_gross_amount_pence")
        .addSelect(
          "fs.commission_percent_basis_points",
          "finance_commission_percent_basis_points",
        )
        .addSelect(
          "fs.commission_amount_pence",
          "finance_commission_amount_pence",
        )
        .addSelect(
          "fs.instructor_net_amount_pence",
          "finance_instructor_net_amount_pence",
        )
        .addSelect("fs.commission_status", "finance_commission_status")
        .addSelect("fs.payout_status", "finance_payout_status")
        .addSelect("fs.finance_integrity_status", "finance_integrity_status")
        .addSelect("fs.finance_notes", "finance_notes")
        .addSelect("fs.snapshot_version", "finance_snapshot_version")
        .addSelect("fs.updated_at", "finance_updated_at")
        .orderBy("l.scheduled_at", "ASC", "NULLS LAST")
        .addOrderBy("l.created_at", "DESC")
        .getRawMany<{
          id: string;
          instructor_id: string;
          learner_user_id: string;
          scheduled_at: Date | null;
          duration_minutes: number | null;
          status: LessonEntity["status"];
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
          finance_id: string | null;
          finance_booking_source: LessonFinanceBookingSource | null;
          finance_currency_code: string | null;
          finance_gross_amount_pence: number | null;
          finance_commission_percent_basis_points: number | null;
          finance_commission_amount_pence: number | null;
          finance_instructor_net_amount_pence: number | null;
          finance_commission_status: string | null;
          finance_payout_status: string | null;
          finance_integrity_status: string | null;
          finance_notes: string | null;
          finance_snapshot_version: number | null;
          finance_updated_at: Date | null;
        }>();

      return rows.map((row) => ({
        id: row.id,
        instructorId: row.instructor_id,
        learnerUserId: row.learner_user_id,
        scheduledAt: row.scheduled_at,
        durationMinutes:
          row.duration_minutes !== null ? Number(row.duration_minutes) : null,
        status: row.status,
        availabilitySlotId: row.availability_slot_id,
        pickupAddress: row.pickup_address,
        pickupPostcode: row.pickup_postcode,
        pickupLat: row.pickup_lat !== null ? Number(row.pickup_lat) : null,
        pickupLng: row.pickup_lng !== null ? Number(row.pickup_lng) : null,
        pickupPlaceId: row.pickup_place_id,
        pickupNote: row.pickup_note,
        pickupContactNumber: row.pickup_contact_number,
        learnerName: row.learner_name ?? "Learner",
        learnerEmail: row.learner_email ?? null,
        learnerPhone: row.learner_phone ?? null,
        instructorName: instructor.fullName,
        finance: this.mapFinanceFromLessonRow(row),
      }));
    }

    if (role === "learner") {
      const rows = await this.lessonsRepo
        .createQueryBuilder("l")
        .leftJoin("instructors", "i", "i.id = l.instructor_id")
        .leftJoin("users", "learner", "learner.id = l.learner_user_id")
        .leftJoin("lesson_finance_snapshots", "fs", "fs.lesson_id = l.id")
        .where("l.learner_user_id = :learnerUserId", {
          learnerUserId: user.userId,
        })
        .andWhere("l.deleted_at IS NULL")
        .select("l.id", "id")
        .addSelect("l.instructor_id", "instructor_id")
        .addSelect("l.learner_user_id", "learner_user_id")
        .addSelect("l.scheduled_at", "scheduled_at")
        .addSelect("l.duration_minutes", "duration_minutes")
        .addSelect("l.status", "status")
        .addSelect("l.availability_slot_id", "availability_slot_id")
        .addSelect("l.pickup_address", "pickup_address")
        .addSelect("l.pickup_postcode", "pickup_postcode")
        .addSelect("l.pickup_lat", "pickup_lat")
        .addSelect("l.pickup_lng", "pickup_lng")
        .addSelect("l.pickup_place_id", "pickup_place_id")
        .addSelect("l.pickup_note", "pickup_note")
        .addSelect("l.pickup_contact_number", "pickup_contact_number")
        .addSelect("i.full_name", "instructor_name")
        .addSelect("learner.name", "learner_name")
        .addSelect("learner.email", "learner_email")
        .addSelect("learner.phone", "learner_phone")
        .addSelect("fs.id", "finance_id")
        .addSelect("fs.booking_source", "finance_booking_source")
        .addSelect("fs.currency_code", "finance_currency_code")
        .addSelect("fs.gross_amount_pence", "finance_gross_amount_pence")
        .addSelect(
          "fs.commission_percent_basis_points",
          "finance_commission_percent_basis_points",
        )
        .addSelect(
          "fs.commission_amount_pence",
          "finance_commission_amount_pence",
        )
        .addSelect(
          "fs.instructor_net_amount_pence",
          "finance_instructor_net_amount_pence",
        )
        .addSelect("fs.commission_status", "finance_commission_status")
        .addSelect("fs.payout_status", "finance_payout_status")
        .addSelect("fs.finance_integrity_status", "finance_integrity_status")
        .addSelect("fs.finance_notes", "finance_notes")
        .addSelect("fs.snapshot_version", "finance_snapshot_version")
        .addSelect("fs.updated_at", "finance_updated_at")
        .orderBy("l.scheduled_at", "ASC", "NULLS LAST")
        .addOrderBy("l.created_at", "DESC")
        .getRawMany<{
          id: string;
          instructor_id: string;
          learner_user_id: string;
          scheduled_at: Date | null;
          duration_minutes: number | null;
          status: LessonEntity["status"];
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
          finance_id: string | null;
          finance_booking_source: LessonFinanceBookingSource | null;
          finance_currency_code: string | null;
          finance_gross_amount_pence: number | null;
          finance_commission_percent_basis_points: number | null;
          finance_commission_amount_pence: number | null;
          finance_instructor_net_amount_pence: number | null;
          finance_commission_status: string | null;
          finance_payout_status: string | null;
          finance_integrity_status: string | null;
          finance_notes: string | null;
          finance_snapshot_version: number | null;
          finance_updated_at: Date | null;
        }>();

      return rows.map((row) => ({
        id: row.id,
        instructorId: row.instructor_id,
        learnerUserId: row.learner_user_id,
        scheduledAt: row.scheduled_at,
        durationMinutes:
          row.duration_minutes !== null ? Number(row.duration_minutes) : null,
        status: row.status,
        availabilitySlotId: row.availability_slot_id,
        pickupAddress: row.pickup_address,
        pickupPostcode: row.pickup_postcode,
        pickupLat: row.pickup_lat !== null ? Number(row.pickup_lat) : null,
        pickupLng: row.pickup_lng !== null ? Number(row.pickup_lng) : null,
        pickupPlaceId: row.pickup_place_id,
        pickupNote: row.pickup_note,
        pickupContactNumber: row.pickup_contact_number,
        instructorName: row.instructor_name ?? "Instructor",
        learnerName: row.learner_name ?? null,
        learnerEmail: row.learner_email ?? null,
        learnerPhone: row.learner_phone ?? null,
        finance: this.mapFinanceFromLessonRow(row),
      }));
    }

    throw new ForbiddenException("Unsupported role");
  }

  async createLessonStripeCheckout(
    user: AuthenticatedRequestUser,
    lessonId: string,
  ) {
    this.requireRole(user, "learner");
    const { lesson, instructor } = await this.loadLearnerLessonContext(
      user.userId,
      lessonId,
    );
    if (!["requested", "accepted", "planned"].includes(lesson.status)) {
      throw new BadRequestException(
        `Lesson payment can only be started for requested, accepted, or planned lessons`,
      );
    }
    const amountPence = this.resolveLessonAmountPence(lesson, instructor);
    const stripeSecret = this.requireStripeSecretKey();

    const existingPayment = await this.lessonPaymentsRepo.findOne({
      where: { lessonId },
    });
    if (existingPayment?.status === "captured") {
      return {
        lessonId,
        paymentStatus: "captured",
        checkoutSessionId: existingPayment.checkoutSessionId,
        checkoutUrl: existingPayment.checkoutUrl,
        payment: this.mapLessonPayment(existingPayment),
      };
    }
    if (
      existingPayment?.provider === "stripe" &&
      existingPayment.status === "checkout_created" &&
      existingPayment.checkoutSessionId &&
      existingPayment.checkoutUrl
    ) {
      return {
        lessonId,
        paymentStatus: "pending",
        checkoutSessionId: existingPayment.checkoutSessionId,
        checkoutUrl: existingPayment.checkoutUrl,
        payment: this.mapLessonPayment(existingPayment),
      };
    }

    const successUrl =
      process.env.STRIPE_LESSON_CHECKOUT_SUCCESS_URL ??
      process.env.STRIPE_CHECKOUT_SUCCESS_URL ??
      "drivest://lesson-payment/success?session_id={CHECKOUT_SESSION_ID}";
    const cancelUrl =
      process.env.STRIPE_LESSON_CHECKOUT_CANCEL_URL ??
      process.env.STRIPE_CHECKOUT_CANCEL_URL ??
      "drivest://lesson-payment/cancel";

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("payment_method_types[0]", "card");
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "gbp");
    params.set("line_items[0][price_data][unit_amount]", String(amountPence));
    params.set(
      "line_items[0][price_data][product_data][name]",
      `Driving lesson with ${instructor.fullName}`,
    );
    params.set("metadata[lesson_id]", lesson.id);
    params.set("metadata[instructor_id]", instructor.id);
    params.set("metadata[learner_user_id]", lesson.learnerUserId);
    params.set("client_reference_id", lesson.id);

    const stripeCheckout = await this.postStripeForm(
      "/checkout/sessions",
      params,
      stripeSecret,
    );
    const isCaptured =
      String(stripeCheckout?.payment_status ?? "").toLowerCase() === "paid";
    const checkoutSessionId = this.readString(stripeCheckout?.id);
    if (!checkoutSessionId) {
      throw new BadRequestException(
        "Stripe checkout session was created without a session id",
      );
    }

    const payment =
      existingPayment ?? this.lessonPaymentsRepo.create({ lessonId });
    payment.provider = "stripe";
    payment.status = isCaptured ? "captured" : "checkout_created";
    payment.currencyCode = "GBP";
    payment.amountPence = amountPence;
    payment.checkoutSessionId = checkoutSessionId;
    payment.checkoutUrl = this.normaliseOptionalText(
      this.readString(stripeCheckout?.url),
    );
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
      action: "LESSON_PAYMENT_STRIPE_CHECKOUT_CREATED",
      metadata: {
        lessonId: lesson.id,
        amountPence,
        checkoutSessionId: savedPayment.checkoutSessionId,
        status: savedPayment.status,
      },
    });

    return {
      lessonId,
      paymentStatus:
        savedPayment.status === "captured" ? "captured" : "pending",
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
    this.requireRole(user, "learner");
    const { lesson, instructor } = await this.loadLearnerLessonContext(
      user.userId,
      lessonId,
    );
    const stripeSecret = this.requireStripeSecretKey();

    const payment = await this.lessonPaymentsRepo.findOne({
      where: { lessonId },
    });
    if (
      payment?.checkoutSessionId &&
      payment.checkoutSessionId !== dto.checkoutSessionId &&
      payment.provider === "stripe"
    ) {
      throw new BadRequestException(
        "Checkout session does not match the stored payment session",
      );
    }

    const stripeCheckout = await this.getStripe(
      `/checkout/sessions/${encodeURIComponent(dto.checkoutSessionId)}`,
      stripeSecret,
    );
    const paymentStatusRaw = String(
      stripeCheckout?.payment_status ?? "",
    ).toLowerCase();
    const isCaptured = paymentStatusRaw === "paid";
    const amountPence = this.resolveLessonAmountPence(lesson, instructor);

    const upsert = payment ?? this.lessonPaymentsRepo.create({ lessonId });
    upsert.provider = "stripe";
    upsert.status = isCaptured ? "captured" : "pending";
    upsert.currencyCode = "GBP";
    upsert.amountPence = amountPence;
    upsert.checkoutSessionId = dto.checkoutSessionId;
    upsert.checkoutUrl = this.normaliseOptionalText(
      this.readString(stripeCheckout?.url),
    );
    upsert.paymentIntentId = this.normaliseOptionalText(
      this.readString(stripeCheckout?.payment_intent),
    );
    upsert.rawProviderPayload = stripeCheckout ?? null;
    upsert.failureReason = isCaptured ? null : "Stripe payment not yet paid";
    upsert.capturedAt = isCaptured ? new Date() : null;
    const savedPayment = await this.lessonPaymentsRepo.save(upsert);

    await this.auditRepo.save({
      userId: user.userId,
      action: "LESSON_PAYMENT_STRIPE_CONFIRMED",
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
    this.requireRole(user, "learner");
    const { lesson, instructor } = await this.loadLearnerLessonContext(
      user.userId,
      lessonId,
    );
    const amountPence = this.resolveLessonAmountPence(lesson, instructor);

    const existing = await this.lessonPaymentsRepo.findOne({
      where: { lessonId },
    });
    if (existing?.provider === "stripe" && existing.status === "captured") {
      throw new BadRequestException(
        "Stripe payment already captured for this lesson",
      );
    }

    const payment = existing ?? this.lessonPaymentsRepo.create({ lessonId });
    payment.provider = "apple_iap";
    payment.status = "captured";
    payment.currencyCode = "GBP";
    payment.amountPence = amountPence;
    payment.checkoutSessionId = null;
    payment.checkoutUrl = null;
    payment.paymentIntentId = null;
    payment.productId = dto.productId;
    payment.transactionId = dto.transactionId;
    payment.capturedAt = dto.purchasedAt
      ? new Date(dto.purchasedAt)
      : new Date();
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
      action: "LESSON_PAYMENT_APPLE_ACTIVATED",
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
      throw new ForbiddenException("Role is required");
    }

    const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId } });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException("Lesson not found");
    }

    if (role === "learner") {
      if (lesson.learnerUserId !== user.userId) {
        throw new ForbiddenException(
          "Only lesson participants can view payment",
        );
      }
    } else if (role === "instructor") {
      const instructor = await this.findInstructorForUser(user.userId);
      if (!instructor || instructor.id !== lesson.instructorId) {
        throw new ForbiddenException(
          "Only lesson participants can view payment",
        );
      }
    }

    const payment = await this.lessonPaymentsRepo.findOne({
      where: { lessonId },
    });
    const finance = await this.lessonFinanceRepo.findOne({
      where: { lessonId },
    });
    return {
      lessonId,
      payment: payment ? this.mapLessonPayment(payment) : null,
      finance: this.mapLessonFinanceSnapshot(finance, lessonId),
    };
  }

  async createReview(
    user: AuthenticatedRequestUser,
    instructorId: string,
    dto: CreateReviewDto,
  ) {
    this.requireRole(user, "learner");

    const instructor = await this.instructorsRepo.findOne({
      where: { id: instructorId },
    });
    if (!instructor || instructor.deletedAt) {
      throw new NotFoundException("Instructor not found");
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const reviewCount = await this.reviewsRepo
      .createQueryBuilder("r")
      .where("r.learner_user_id = :learnerUserId", {
        learnerUserId: user.userId,
      })
      .andWhere("r.created_at >= :windowStart", {
        windowStart: twentyFourHoursAgo,
      })
      .andWhere("r.deleted_at IS NULL")
      .getCount();

    if (reviewCount >= 3) {
      throw new BadRequestException(
        "Review limit reached. Please try again later.",
      );
    }

    const lesson = await this.lessonsRepo.findOne({
      where: { id: dto.lessonId },
    });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException("Lesson not found");
    }

    if (
      lesson.instructorId !== instructorId ||
      lesson.learnerUserId !== user.userId
    ) {
      throw new ForbiddenException(
        "Lesson does not match this instructor or learner",
      );
    }

    if (lesson.status !== "completed") {
      throw new BadRequestException("You can only review completed lessons");
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
      throw new BadRequestException("You have already reviewed this lesson");
    }

    const review = this.reviewsRepo.create({
      instructorId,
      learnerUserId: user.userId,
      lessonId: dto.lessonId,
      rating: dto.rating,
      reviewText: dto.reviewText ?? null,
      status: "visible",
    });
    const savedReview = await this.reviewsRepo.save(review);
    await this.recordReviewAuditEvent(
      "INSTRUCTOR_REVIEW_CREATED",
      user.userId,
      savedReview,
      {
        statusTo: savedReview.status,
        rating: savedReview.rating,
      },
    );
    await this.notificationsService.createForUser(
      instructor.userId,
      "lesson_update",
      "New learner review",
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

  async listPendingReviews(user: AuthenticatedRequestUser) {
    this.requireRole(user, "learner");

    const reviewWindowDays = this.resolvePendingReviewWindowDays();
    const reviewWindowStart = new Date(
      Date.now() - reviewWindowDays * 24 * 60 * 60 * 1000,
    );
    const lessons = await this.lessonsRepo.find({
      where: {
        learnerUserId: user.userId,
        status: "completed",
        deletedAt: IsNull(),
      },
      order: { updatedAt: "DESC" },
    });

    const eligibleLessons = lessons.filter((lesson) => {
      const completedAt = this.resolveReviewCompletedAt(lesson);
      return completedAt.getTime() >= reviewWindowStart.getTime();
    });
    if (!eligibleLessons.length) {
      return { items: [] };
    }

    const lessonIds = eligibleLessons.map((lesson) => lesson.id);
    const existingReviews = await this.reviewsRepo.find({
      where: {
        learnerUserId: user.userId,
        lessonId: In(lessonIds),
      },
      withDeleted: true,
    });
    const reviewedLessonIds = new Set(
      existingReviews.map((review) => review.lessonId),
    );
    const pendingLessons = eligibleLessons.filter(
      (lesson) => !reviewedLessonIds.has(lesson.id),
    );
    if (!pendingLessons.length) {
      return { items: [] };
    }

    const instructorIds = Array.from(
      new Set(pendingLessons.map((lesson) => lesson.instructorId)),
    );
    const instructors = instructorIds.length
      ? await this.instructorsRepo.find({ where: { id: In(instructorIds) } })
      : [];
    const instructorNameById = new Map(
      instructors.map((instructor) => [instructor.id, instructor.fullName]),
    );

    return {
      items: pendingLessons.map((lesson) => {
        const completedAt = this.resolveReviewCompletedAt(lesson);
        return {
          lessonId: lesson.id,
          instructorId: lesson.instructorId,
          instructorName:
            instructorNameById.get(lesson.instructorId) ?? "Instructor",
          scheduledAt: lesson.scheduledAt
            ? lesson.scheduledAt.toISOString()
            : null,
          completedAt: completedAt.toISOString(),
          reviewDueBy: new Date(
            completedAt.getTime() + reviewWindowDays * 24 * 60 * 60 * 1000,
          ).toISOString(),
          hasReminderBeenSent: false,
        };
      }),
    };
  }

  async reportReview(
    user: AuthenticatedRequestUser,
    reviewId: string,
    dto: ReportReviewDto,
  ) {
    const review = await this.findReviewOrThrow(reviewId, true);
    if (review.deletedAt || review.status === "removed") {
      throw new BadRequestException("Removed reviews cannot be reported");
    }

    const role = normaliseRole(user.role);
    if (role === "instructor") {
      const instructor = await this.getInstructorForUser(user.userId);
      if (instructor.id !== review.instructorId) {
        throw new ForbiddenException(
          "You can only report reviews on your own profile",
        );
      }
    } else if (role === "learner") {
      if (review.learnerUserId !== user.userId) {
        throw new ForbiddenException("You can only report your own review");
      }
    } else {
      throw new ForbiddenException("Role is required");
    }

    const statusFrom = review.status;
    review.reportedCount = (review.reportedCount ?? 0) + 1;
    review.lastReportedReasonCode = dto.reasonCode.trim();
    review.lastReportedNote = this.normaliseOptionalText(dto.note);
    review.lastReportedAt = new Date();
    if (review.status === "visible") {
      review.status = "flagged";
    }
    const saved = await this.reviewsRepo.save(review);
    await this.recordReviewAuditEvent(
      "INSTRUCTOR_REVIEW_REPORTED",
      user.userId,
      saved,
      {
        statusFrom,
        statusTo: saved.status,
        reasonCode: saved.lastReportedReasonCode,
        note: saved.lastReportedNote,
        reportedCount: saved.reportedCount,
      },
    );
    return saved;
  }

  async listAdminReviews(query: ListAdminReviewsQueryDto) {
    const limit = Math.max(1, Math.min(query.limit ?? 50, 100));
    const qb = this.reviewsRepo.createQueryBuilder("r");
    if (typeof (qb as any).withDeleted === "function") {
      (qb as any).withDeleted();
    }

    qb.orderBy("r.created_at", "DESC").limit(limit);

    if (query.status) {
      qb.andWhere("r.status = :status", { status: query.status });
    }
    if (query.reportedOnly) {
      qb.andWhere("COALESCE(r.reported_count, 0) > 0");
    }
    if (query.instructorId) {
      qb.andWhere("r.instructor_id = :instructorId", {
        instructorId: query.instructorId,
      });
    }
    if (query.from) {
      qb.andWhere("r.created_at >= :from", { from: query.from });
    }
    if (query.to) {
      qb.andWhere("r.created_at <= :to", { to: query.to });
    }

    const reviews = await qb.getMany();
    return {
      items: await this.enrichAdminReviews(reviews),
    };
  }

  async getAdminReviewDetail(reviewId: string) {
    const review = await this.findReviewOrThrow(reviewId, true);
    const [detail] = await this.enrichAdminReviews([review]);
    return detail;
  }

  async flagReview(
    reviewId: string,
    actorUserId?: string | null,
    moderationReason?: string,
  ) {
    return this.updateReviewStatus(
      reviewId,
      "flagged",
      actorUserId,
      moderationReason,
    );
  }

  async hideReview(
    reviewId: string,
    actorUserId?: string | null,
    moderationReason?: string,
  ) {
    return this.updateReviewStatus(
      reviewId,
      "hidden",
      actorUserId,
      moderationReason,
    );
  }

  async removeReview(
    reviewId: string,
    actorUserId?: string | null,
    moderationReason?: string,
  ) {
    return this.updateReviewStatus(
      reviewId,
      "removed",
      actorUserId,
      moderationReason,
    );
  }

  async restoreReview(
    reviewId: string,
    actorUserId?: string | null,
    moderationReason?: string,
  ) {
    const review = await this.findReviewOrThrow(reviewId, true);
    const statusFrom = review.status;
    if (
      review.deletedAt &&
      typeof (this.reviewsRepo as any).restore === "function"
    ) {
      await (this.reviewsRepo as any).restore(review.id);
    }
    review.deletedAt = null;
    review.status = "visible";
    review.moderatedAt = new Date();
    review.moderatedByUserId = actorUserId ?? null;
    review.moderationReason = this.normaliseOptionalText(moderationReason);
    const saved = await this.reviewsRepo.save(review);
    await this.recordReviewAuditEvent(
      "INSTRUCTOR_REVIEW_RESTORED",
      actorUserId ?? null,
      saved,
      {
        statusFrom,
        statusTo: saved.status,
        moderationReason: saved.moderationReason,
      },
    );
    return saved;
  }

  async getAdminFinanceSummary(query: AdminFinanceReportQueryDto) {
    const { from, to } = this.resolveAdminDateRange(query.from, query.to);

    const summaryRow = await this.lessonsRepo.query(
      `
        SELECT
          COUNT(l.id)::int AS total_lessons_count,
          COUNT(*) FILTER (WHERE fs.booking_source = 'marketplace')::int AS marketplace_lessons_count,
          COALESCE(SUM(fs.gross_amount_pence), 0)::bigint AS gross_booking_value_total_pence,
          COALESCE(SUM(fs.commission_amount_pence), 0)::bigint AS total_estimated_commission_pence,
          COALESCE(SUM(fs.instructor_net_amount_pence), 0)::bigint AS total_instructor_net_pence,
          COUNT(*) FILTER (WHERE fs.id IS NULL)::int AS missing_finance_snapshot_count,
          COUNT(*) FILTER (
            WHERE fs.finance_integrity_status IN ('sync_failed', 'stale')
          )::int AS stale_or_sync_failed_count
        FROM lessons l
        LEFT JOIN lesson_finance_snapshots fs ON fs.lesson_id = l.id
        WHERE l.deleted_at IS NULL
          AND COALESCE(l.scheduled_at, l.created_at) >= $1
          AND COALESCE(l.scheduled_at, l.created_at) < $2
      `,
      [from, to],
    );

    const commissionStatusRows = await this.lessonsRepo.query(
      `
        SELECT
          COALESCE(fs.commission_status, 'missing') AS status,
          COUNT(l.id)::int AS count
        FROM lessons l
        LEFT JOIN lesson_finance_snapshots fs ON fs.lesson_id = l.id
        WHERE l.deleted_at IS NULL
          AND COALESCE(l.scheduled_at, l.created_at) >= $1
          AND COALESCE(l.scheduled_at, l.created_at) < $2
        GROUP BY COALESCE(fs.commission_status, 'missing')
      `,
      [from, to],
    );

    const payoutStatusRows = await this.lessonsRepo.query(
      `
        SELECT
          COALESCE(fs.payout_status, 'missing') AS status,
          COUNT(l.id)::int AS count
        FROM lessons l
        LEFT JOIN lesson_finance_snapshots fs ON fs.lesson_id = l.id
        WHERE l.deleted_at IS NULL
          AND COALESCE(l.scheduled_at, l.created_at) >= $1
          AND COALESCE(l.scheduled_at, l.created_at) < $2
        GROUP BY COALESCE(fs.payout_status, 'missing')
      `,
      [from, to],
    );

    const row = summaryRow?.[0] ?? {};
    return {
      from,
      to,
      totals: {
        totalLessonsCount: Number(row.total_lessons_count ?? 0),
        marketplaceLessonsCount: Number(row.marketplace_lessons_count ?? 0),
        grossBookingValueTotalPence: Number(
          row.gross_booking_value_total_pence ?? 0,
        ),
        totalEstimatedCommissionPence: Number(
          row.total_estimated_commission_pence ?? 0,
        ),
        totalInstructorNetPence: Number(row.total_instructor_net_pence ?? 0),
      },
      diagnostics: {
        missingFinanceSnapshotCount: Number(
          row.missing_finance_snapshot_count ?? 0,
        ),
        staleOrSyncFailedCount: Number(row.stale_or_sync_failed_count ?? 0),
      },
      countByCommissionStatus: this.toStatusCountMap(commissionStatusRows),
      countByPayoutStatus: this.toStatusCountMap(payoutStatusRows),
    };
  }

  async getAdminFinanceByInstructor(query: AdminFinanceReportQueryDto) {
    const { from, to } = this.resolveAdminDateRange(query.from, query.to);

    const rows = await this.lessonsRepo.query(
      `
        SELECT
          i.id AS instructor_id,
          i.full_name AS full_name,
          COUNT(l.id)::int AS lesson_count,
          COUNT(*) FILTER (WHERE fs.booking_source = 'marketplace')::int AS marketplace_lesson_count,
          COALESCE(SUM(fs.gross_amount_pence), 0)::bigint AS gross_value_pence,
          COALESCE(SUM(fs.commission_amount_pence), 0)::bigint AS commission_total_pence,
          COALESCE(SUM(fs.instructor_net_amount_pence), 0)::bigint AS net_total_pence,
          COUNT(*) FILTER (WHERE fs.id IS NULL)::int AS missing_finance_snapshot_count,
          COUNT(*) FILTER (
            WHERE fs.finance_integrity_status IN ('sync_failed', 'stale')
          )::int AS stale_or_sync_failed_count,
          COUNT(*) FILTER (WHERE fs.payout_status = 'pending')::int AS payout_pending_count,
          COUNT(*) FILTER (WHERE fs.payout_status = 'on_hold')::int AS payout_on_hold_count,
          COUNT(*) FILTER (WHERE fs.payout_status = 'ready_for_manual_payout')::int AS payout_ready_for_manual_payout_count,
          COUNT(*) FILTER (WHERE fs.payout_status = 'marked_paid')::int AS payout_marked_paid_count,
          COUNT(*) FILTER (WHERE fs.payout_status = 'voided')::int AS payout_voided_count,
          COUNT(*) FILTER (WHERE fs.payout_status = 'not_applicable')::int AS payout_not_applicable_count
        FROM lessons l
        JOIN instructors i ON i.id = l.instructor_id
        LEFT JOIN lesson_finance_snapshots fs ON fs.lesson_id = l.id
        WHERE l.deleted_at IS NULL
          AND i.deleted_at IS NULL
          AND COALESCE(l.scheduled_at, l.created_at) >= $1
          AND COALESCE(l.scheduled_at, l.created_at) < $2
        GROUP BY i.id, i.full_name
        ORDER BY i.full_name ASC
      `,
      [from, to],
    );

    const filteredRows = query.instructorId
      ? rows.filter(
          (row: Record<string, unknown>) =>
            row.instructor_id === query.instructorId,
        )
      : rows;

    return {
      from,
      to,
      instructors: filteredRows.map((row: Record<string, unknown>) => ({
        instructorId: row.instructor_id,
        fullName: row.full_name,
        lessonCount: Number(row.lesson_count ?? 0),
        marketplaceLessonCount: Number(row.marketplace_lesson_count ?? 0),
        grossValuePence: Number(row.gross_value_pence ?? 0),
        commissionTotalPence: Number(row.commission_total_pence ?? 0),
        netTotalPence: Number(row.net_total_pence ?? 0),
        diagnostics: {
          missingFinanceSnapshotCount: Number(
            row.missing_finance_snapshot_count ?? 0,
          ),
          staleOrSyncFailedCount: Number(row.stale_or_sync_failed_count ?? 0),
        },
        payoutStatusBreakdown: {
          pending: Number(row.payout_pending_count ?? 0),
          on_hold: Number(row.payout_on_hold_count ?? 0),
          ready_for_manual_payout: Number(
            row.payout_ready_for_manual_payout_count ?? 0,
          ),
          marked_paid: Number(row.payout_marked_paid_count ?? 0),
          voided: Number(row.payout_voided_count ?? 0),
          not_applicable: Number(row.payout_not_applicable_count ?? 0),
        },
      })),
    };
  }

  async getAdminFinanceLessons(query: AdminFinanceReportQueryDto) {
    const { from, to } = this.resolveAdminDateRange(query.from, query.to);
    const limit = query.limit ?? 200;

    const params: unknown[] = [from, to];
    const whereClauses = [
      "l.deleted_at IS NULL",
      "COALESCE(l.scheduled_at, l.created_at) >= $1",
      "COALESCE(l.scheduled_at, l.created_at) < $2",
    ];

    if (query.instructorId) {
      params.push(query.instructorId);
      whereClauses.push(`l.instructor_id = $${params.length}`);
    }
    if (query.lessonStatus) {
      params.push(query.lessonStatus);
      whereClauses.push(`l.status = $${params.length}`);
    }
    if (query.commissionStatus) {
      params.push(query.commissionStatus);
      whereClauses.push(`fs.commission_status = $${params.length}`);
    }
    if (query.payoutStatus) {
      params.push(query.payoutStatus);
      whereClauses.push(`fs.payout_status = $${params.length}`);
    }

    params.push(limit);

    const rows = await this.lessonsRepo.query(
      `
        SELECT
          l.id AS lesson_id,
          l.status AS lesson_status,
          l.scheduled_at AS scheduled_at,
          l.duration_minutes AS duration_minutes,
          l.created_at AS lesson_created_at,
          l.updated_at AS lesson_updated_at,
          i.id AS instructor_id,
          i.full_name AS instructor_name,
          u.id AS learner_user_id,
          u.name AS learner_name,
          fs.id AS finance_id,
          fs.currency_code AS finance_currency_code,
          fs.booking_source AS finance_booking_source,
          fs.gross_amount_pence AS finance_gross_amount_pence,
          fs.commission_percent_basis_points AS finance_commission_percent_basis_points,
          fs.commission_amount_pence AS finance_commission_amount_pence,
          fs.instructor_net_amount_pence AS finance_instructor_net_amount_pence,
          fs.commission_status AS finance_commission_status,
          fs.payout_status AS finance_payout_status,
          fs.finance_integrity_status AS finance_integrity_status,
          fs.finance_notes AS finance_notes,
          fs.snapshot_version AS finance_snapshot_version,
          fs.updated_at AS finance_updated_at
        FROM lessons l
        JOIN instructors i ON i.id = l.instructor_id
        JOIN users u ON u.id = l.learner_user_id
        LEFT JOIN lesson_finance_snapshots fs ON fs.lesson_id = l.id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY COALESCE(l.scheduled_at, l.created_at) DESC
        LIMIT $${params.length}
      `,
      params,
    );

    return {
      from,
      to,
      lessons: rows.map((row: Record<string, unknown>) => ({
        lessonId: row.lesson_id,
        status: row.lesson_status,
        scheduledAt: row.scheduled_at,
        durationMinutes:
          row.duration_minutes !== null ? Number(row.duration_minutes) : null,
        createdAt: row.lesson_created_at,
        updatedAt: row.lesson_updated_at,
        instructor: {
          id: row.instructor_id,
          fullName: row.instructor_name,
        },
        learner: {
          userId: row.learner_user_id,
          name: row.learner_name,
        },
        finance: row.finance_id
          ? {
              id: row.finance_id,
              currencyCode: row.finance_currency_code,
              bookingSource: row.finance_booking_source,
              grossAmountPence:
                row.finance_gross_amount_pence !== null
                  ? Number(row.finance_gross_amount_pence)
                  : null,
              commissionPercentBasisPoints:
                row.finance_commission_percent_basis_points !== null
                  ? Number(row.finance_commission_percent_basis_points)
                  : null,
              commissionAmountPence:
                row.finance_commission_amount_pence !== null
                  ? Number(row.finance_commission_amount_pence)
                  : null,
              instructorNetAmountPence:
                row.finance_instructor_net_amount_pence !== null
                  ? Number(row.finance_instructor_net_amount_pence)
                  : null,
              commissionStatus: row.finance_commission_status,
              payoutStatus: row.finance_payout_status,
              financeIntegrityStatus: row.finance_integrity_status,
              financeNotes: row.finance_notes,
              snapshotVersion:
                row.finance_snapshot_version !== null
                  ? Number(row.finance_snapshot_version)
                  : null,
              updatedAt: row.finance_updated_at,
            }
          : {
              financeIntegrityStatus: "missing",
            },
      })),
    };
  }

  async repairLessonFinanceSnapshots(dto: AdminFinanceRepairDto) {
    const { from, to } = this.resolveAdminDateRange(dto.from, dto.to);
    const dryRun = dto.dryRun === true;
    const limit = dto.limit ?? 500;

    const targets = await this.lessonsRepo.query(
      `
        SELECT l.id AS lesson_id
        FROM lessons l
        LEFT JOIN lesson_finance_snapshots fs ON fs.lesson_id = l.id
        WHERE l.deleted_at IS NULL
          AND COALESCE(l.scheduled_at, l.created_at) >= $1
          AND COALESCE(l.scheduled_at, l.created_at) < $2
          AND (
            fs.id IS NULL
            OR fs.finance_integrity_status IN ('sync_failed', 'stale')
          )
        ORDER BY COALESCE(l.scheduled_at, l.created_at) DESC
        LIMIT $3
      `,
      [from, to, limit],
    );

    const targetLessonIds = targets
      .map((row: Record<string, unknown>) => String(row.lesson_id ?? ""))
      .filter(Boolean);

    let repaired = 0;
    let failed = 0;
    let skipped = 0;
    for (const lessonId of targetLessonIds) {
      if (dryRun) {
        skipped += 1;
        continue;
      }
      try {
        await this.refreshLessonFinanceSnapshotWithFallback(lessonId, {
          reason: "admin_repair",
          actorUserId: null,
        });
        repaired += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      from,
      to,
      dryRun,
      targetCount: targetLessonIds.length,
      repaired,
      skipped,
      failed,
    };
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
        .createQueryBuilder("s")
        .setLock("pessimistic_write")
        .where("s.id = :slotId", { slotId: dto.availabilitySlotId })
        .andWhere("s.deleted_at IS NULL")
        .getOne();

      if (!slot) {
        throw new NotFoundException("Availability slot not found");
      }
      if (slot.status !== "open" || slot.bookedLessonId) {
        throw new BadRequestException("This time slot is no longer available");
      }

      const instructor = await instructorRepo.findOne({
        where: { id: slot.instructorId },
      });
      if (
        !instructor ||
        instructor.deletedAt ||
        !instructor.isApproved ||
        instructor.suspendedAt
      ) {
        throw new BadRequestException(
          "Instructor is not available for lessons",
        );
      }

      if (dto.instructorId && dto.instructorId !== slot.instructorId) {
        throw new BadRequestException(
          "Instructor does not match selected time slot",
        );
      }

      await this.ensureNoLessonConflicts(
        slot.instructorId,
        slot.startsAt,
        this.diffMinutes(slot.startsAt, slot.endsAt),
      );

      const learner = await manager.getRepository(User).findOne({
        where: { id: user.userId },
        select: ["id", "phone"],
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
        status: "requested",
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
      slot.status = "booked";
      slot.bookedLessonId = savedLesson.id;
      await slotRepo.save(slot);
      const financeSnapshot =
        await this.refreshLessonFinanceSnapshotWithFallback(savedLesson.id, {
          manager,
          reason: "lesson_created_from_slot",
          actorUserId: user.userId,
          bookingSource: "marketplace",
        });
      await this.recordLessonAuditEvent(
        "LESSON_CREATED",
        user.userId,
        savedLesson,
        {
          eventVersion: 1,
          actorRole: normaliseRole(user.role) ?? user.role ?? null,
          source: "availability_slot",
          requestedInstructorId: dto.instructorId ?? slot.instructorId,
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
        },
        auditRepo,
      );
      await this.notificationsService.createForUser(
        instructor.userId,
        "booking_request",
        "New lesson request",
        "A learner requested one of your published time slots.",
        {
          lessonId: savedLesson.id,
          availabilitySlotId: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          learnerUserId: user.userId,
        },
        user.userId,
      );
      return this.mapLessonWithFinance(savedLesson, financeSnapshot);
    });
  }

  private async recordLessonAuditEvent(
    action: string,
    actorUserId: string | null,
    lesson: Pick<
      LessonEntity,
      | "id"
      | "instructorId"
      | "learnerUserId"
      | "scheduledAt"
      | "durationMinutes"
      | "status"
      | "availabilitySlotId"
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
        scheduledAt: lesson.scheduledAt
          ? lesson.scheduledAt.toISOString()
          : null,
        durationMinutes: lesson.durationMinutes ?? null,
        status: lesson.status,
        availabilitySlotId: lesson.availabilitySlotId ?? null,
        ...metadata,
      },
    });
  }

  private async refreshLessonFinanceSnapshotWithFallback(
    lessonId: string,
    options: {
      manager?: EntityManager;
      reason: string;
      actorUserId: string | null;
      bookingSource?: LessonFinanceBookingSource;
    },
  ) {
    try {
      return await this.refreshLessonFinanceSnapshot(lessonId, options);
    } catch (error) {
      const manager = options.manager;
      const lessonFinanceRepo = manager
        ? manager.getRepository(LessonFinanceSnapshotEntity)
        : this.lessonFinanceRepo;
      const auditRepo = manager
        ? manager.getRepository(AuditLog)
        : this.auditRepo;
      const existing = await lessonFinanceRepo.findOne({ where: { lessonId } });
      const snapshot =
        existing ??
        lessonFinanceRepo.create({
          lessonId,
          currencyCode: "GBP",
          bookingSource: options.bookingSource ?? "marketplace",
          commissionPercentBasisPoints: 800,
          commissionStatus: "estimated",
          payoutStatus: "pending",
          snapshotVersion: 1,
        });
      snapshot.financeIntegrityStatus = "sync_failed";
      snapshot.financeNotes = this.limitFinanceErrorNote(error);
      const saved = await lessonFinanceRepo.save(snapshot);

      await auditRepo.save({
        userId: options.actorUserId,
        action: "LESSON_FINANCE_SYNC_FAILED",
        metadata: {
          eventVersion: 1,
          lessonId,
          reason: options.reason,
          errorMessage: this.errorMessage(error),
          financeIntegrityStatus: "sync_failed",
        },
      });
      return saved;
    }
  }

  private async refreshLessonFinanceSnapshot(
    lessonId: string,
    options: {
      manager?: EntityManager;
      reason: string;
      actorUserId: string | null;
      bookingSource?: LessonFinanceBookingSource;
    },
  ) {
    const manager = options.manager;
    const lessonRepo = manager
      ? manager.getRepository(LessonEntity)
      : this.lessonsRepo;
    const instructorRepo = manager
      ? manager.getRepository(InstructorEntity)
      : this.instructorsRepo;
    const lessonFinanceRepo = manager
      ? manager.getRepository(LessonFinanceSnapshotEntity)
      : this.lessonFinanceRepo;
    const disputesRepo = manager
      ? manager.getRepository(DisputeCaseEntity)
      : this.disputesRepo;
    const auditRepo = manager
      ? manager.getRepository(AuditLog)
      : this.auditRepo;

    const lesson = await lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException("Lesson not found for finance snapshot");
    }
    const instructor = await instructorRepo.findOne({
      where: { id: lesson.instructorId },
    });
    const existing = await lessonFinanceRepo.findOne({
      where: { lessonId: lesson.id },
    });

    const bookingSource =
      options.bookingSource ?? existing?.bookingSource ?? "marketplace";
    const openDisputeCount = await disputesRepo
      .createQueryBuilder("d")
      .where("d.lesson_id = :lessonId", { lessonId: lesson.id })
      .andWhere("d.deleted_at IS NULL")
      .andWhere(`d.status NOT IN ('resolved', 'closed')`)
      .getCount();

    const computed = computeLessonFinance({
      bookingSource,
      lessonStatus: lesson.status,
      hourlyRatePence: instructor?.hourlyRatePence ?? null,
      durationMinutes: lesson.durationMinutes,
      hasOpenDispute: openDisputeCount > 0,
    });

    const snapshot =
      existing ??
      lessonFinanceRepo.create({
        lessonId: lesson.id,
        currencyCode: "GBP",
        bookingSource,
        snapshotVersion: 1,
      });

    snapshot.currencyCode = "GBP";
    snapshot.bookingSource = bookingSource;
    snapshot.grossAmountPence = computed.grossAmountPence;
    snapshot.commissionPercentBasisPoints =
      computed.commissionPercentBasisPoints;
    snapshot.commissionAmountPence = computed.commissionAmountPence;
    snapshot.instructorNetAmountPence = computed.instructorNetAmountPence;
    snapshot.commissionStatus = computed.commissionStatus;
    snapshot.payoutStatus = computed.payoutStatus;
    snapshot.financeIntegrityStatus = "synced";
    snapshot.financeNotes = computed.financeNotes;
    snapshot.snapshotVersion = existing?.snapshotVersion ?? 1;

    const saved = await lessonFinanceRepo.save(snapshot);
    await auditRepo.save({
      userId: options.actorUserId,
      action: existing
        ? "LESSON_FINANCE_SNAPSHOT_UPDATED"
        : "LESSON_FINANCE_SNAPSHOT_CREATED",
      metadata: {
        eventVersion: 1,
        lessonId: lesson.id,
        reason: options.reason,
        bookingSource: saved.bookingSource,
        commissionStatus: saved.commissionStatus,
        payoutStatus: saved.payoutStatus,
        financeIntegrityStatus: saved.financeIntegrityStatus,
        hasOpenDispute: openDisputeCount > 0,
      },
    });

    return saved;
  }

  private async syncAvailabilitySlotForLessonStatus(
    lesson: LessonEntity,
    manager?: EntityManager,
  ) {
    if (!lesson.availabilitySlotId) return;
    const slotRepo = manager
      ? manager.getRepository(InstructorAvailabilityEntity)
      : this.availabilityRepo;
    const slot = await slotRepo.findOne({
      where: { id: lesson.availabilitySlotId },
    });
    if (!slot || slot.deletedAt) return;

    if (lesson.status === "declined" || lesson.status === "cancelled") {
      slot.status = "open";
      slot.bookedLessonId = null;
      await slotRepo.save(slot);
      return;
    }

    if (lesson.status === "accepted" || lesson.status === "completed") {
      slot.status = "booked";
      slot.bookedLessonId = lesson.id;
      await slotRepo.save(slot);
    }
  }

  private async loadLessonForUpdate(
    lessonRepo: Repository<LessonEntity>,
    lessonId: string,
  ) {
    const candidate = (lessonRepo as any).createQueryBuilder?.("l");
    if (candidate?.setLock) {
      return candidate
        .setLock("pessimistic_write")
        .where("l.id = :lessonId", { lessonId })
        .andWhere("l.deleted_at IS NULL")
        .getOne();
    }
    return lessonRepo.findOne({ where: { id: lessonId } });
  }

  private async getInstructorForUser(userId: string) {
    const instructor = await this.findInstructorForUser(userId);
    if (!instructor) {
      throw new NotFoundException("Instructor profile not found");
    }
    return instructor;
  }

  private async findInstructorForUser(userId: string) {
    const instructor = await this.instructorsRepo.findOne({
      where: { userId },
    });
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
      throw new NotFoundException("Instructor profile not found");
    }

    const fallbackEmail = `pending+${userId.replace(/-/g, "").slice(0, 12)}@drivest.invalid`;
    const profile = this.instructorsRepo.create({
      userId,
      fullName: this.defaultInstructorName(user),
      email: user.email?.trim() || fallbackEmail,
      phone: user.phone ?? null,
      adiNumber: this.temporaryAdiNumber(userId),
      profilePhotoUrl: null,
      yearsExperience: null,
      transmissionType: "both",
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
      const localPart = email.split("@")[0]?.trim();
      if (localPart) {
        return localPart;
      }
    }
    return "Instructor";
  }

  private temporaryAdiNumber(userId: string): string {
    const compact = userId.replace(/-/g, "").toUpperCase();
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

  private async listCoverageSuggestionsFromProfiles(
    query: string,
    limit: number,
  ) {
    const containsQuery = `%${query}%`;
    const prefixQuery = `${query}%`;
    const rows = await this.instructorsRepo.query(
      `
        SELECT
          UPPER(TRIM(pc)) AS value
        FROM instructors i
        CROSS JOIN LATERAL unnest(i.coverage_postcodes) AS pc
        WHERE i.deleted_at IS NULL
          AND i.suspended_at IS NULL
          AND pc IS NOT NULL
          AND TRIM(pc) <> ''
          AND pc ILIKE $1
        GROUP BY UPPER(TRIM(pc))
        ORDER BY
          CASE WHEN UPPER(TRIM(pc)) ILIKE UPPER($2) THEN 0 ELSE 1 END,
          LENGTH(UPPER(TRIM(pc))) ASC
        LIMIT $3
      `,
      [containsQuery, prefixQuery, Math.min(limit * 3, 50)],
    );

    return rows.map((row: { value?: string | null }) => {
      const value = (row.value ?? "").trim().toUpperCase();
      return {
        value,
        kind: this.inferLocationSuggestionKind(value),
        source: "instructor_coverage",
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
      autocomplete: "true",
      fuzzyMatch: "true",
      types: "postcode,place,locality,district,region",
      country: "gb",
      limit: String(limit),
      language: "en",
      access_token: mapboxToken,
    });

    try {
      const response = await axios.get<{
        features?: Array<Record<string, unknown>>;
      }>(`${endpoint}?${params.toString()}`, { timeout: 4500 });
      const features = Array.isArray(response.data?.features)
        ? response.data.features
        : [];

      return features
        .map((feature) => {
          const placeTypes = Array.isArray(feature.place_type)
            ? feature.place_type.map((item) => String(item).toLowerCase())
            : [];
          const textValue = this.readString(feature.text);
          const placeNameValue = this.readString(feature.place_name);
          const derivedValue = placeTypes.includes("postcode")
            ? (textValue ?? placeNameValue ?? "").toUpperCase()
            : (textValue ?? placeNameValue ?? "");

          const value = derivedValue.trim();
          if (!value) {
            return null;
          }
          return {
            value,
            kind: placeTypes.includes("postcode") ? "postcode" : "city",
            source: "mapbox",
          };
        })
        .filter(
          (
            suggestion,
          ): suggestion is {
            value: string;
            kind: "postcode" | "city";
            source: "mapbox";
          } => suggestion !== null,
        );
    } catch {
      return [];
    }
  }

  private mergeLocationSuggestions(
    suggestions: Array<{ value: string; kind: string; source: string }>,
    limit: number,
  ) {
    const deduped = new Map<
      string,
      { value: string; kind: string; source: string }
    >();
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

  private inferLocationSuggestionKind(value: string): "postcode" | "city" {
    return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(value)
      ? "postcode"
      : "city";
  }

  private validateSlotWindow(startsAt: Date, endsAt: Date) {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException("Invalid slot date");
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException("Slot end time must be after start time");
    }
    if ((endsAt.getTime() - startsAt.getTime()) / 60000 > 600) {
      throw new BadRequestException("Slot duration is too long");
    }
  }

  private async ensureNoAvailabilityOverlap(
    instructorId: string,
    startsAt: Date,
    endsAt: Date,
    ignoreSlotId?: string,
  ) {
    const qb = this.availabilityRepo
      .createQueryBuilder("s")
      .where("s.instructor_id = :instructorId", { instructorId })
      .andWhere("s.deleted_at IS NULL")
      .andWhere("s.status IN ('open', 'booked')")
      .andWhere("s.starts_at < :endsAt", { endsAt })
      .andWhere("s.ends_at > :startsAt", { startsAt });

    if (ignoreSlotId) {
      qb.andWhere("s.id != :ignoreSlotId", { ignoreSlotId });
    }

    const overlap = await qb.getOne();
    if (overlap) {
      throw new BadRequestException(
        "Availability conflicts with an existing slot",
      );
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
      .createQueryBuilder("l")
      .where("l.instructor_id = :instructorId", { instructorId })
      .andWhere("l.deleted_at IS NULL")
      .andWhere("l.status IN ('requested', 'accepted', 'completed')")
      .andWhere("l.scheduled_at IS NOT NULL")
      .andWhere("l.duration_minutes IS NOT NULL")
      .andWhere("l.scheduled_at < :endsAt", { endsAt })
      .andWhere(
        "(l.scheduled_at + (l.duration_minutes || ' minutes')::interval) > :startsAt",
        {
          startsAt,
        },
      );

    if (ignoreLessonId) {
      qb.andWhere("l.id != :ignoreLessonId", { ignoreLessonId });
    }

    const clash = await qb.getOne();
    if (clash) {
      throw new BadRequestException("Booking conflicts with another lesson");
    }
  }

  private canLearnerManageLesson(status: LessonEntity["status"]) {
    return (
      status === "requested" || status === "accepted" || status === "planned"
    );
  }

  private resolveLearnerPolicyWindow(
    scheduledAt: Date | null,
  ): "unscheduled" | "over_48h" | "between_24h_48h" | "under_24h" {
    if (!scheduledAt) {
      return "unscheduled";
    }
    const hoursUntilStart = (scheduledAt.getTime() - Date.now()) / 3_600_000;
    if (hoursUntilStart >= 48) {
      return "over_48h";
    }
    if (hoursUntilStart >= 24) {
      return "between_24h_48h";
    }
    return "under_24h";
  }

  private learnerCancellationMessage(
    window: "unscheduled" | "over_48h" | "between_24h_48h" | "under_24h",
    isEmergency: boolean,
  ) {
    switch (window) {
      case "over_48h":
      case "unscheduled":
        return "Learner cancelled this booking more than 48 hours before start.";
      case "between_24h_48h":
        return "Learner cancelled within 24-48 hours. Partial charge or credit policy may apply.";
      case "under_24h":
        return isEmergency
          ? "Learner cancelled within 24 hours with emergency flag. Manual review may apply."
          : "Learner cancelled within 24 hours.";
      default:
        return "Learner cancelled this booking.";
    }
  }

  private learnerRescheduleMessage(
    window: "unscheduled" | "over_48h" | "between_24h_48h" | "under_24h",
    isEmergency: boolean,
  ) {
    switch (window) {
      case "over_48h":
      case "unscheduled":
        return "Learner rescheduled this booking.";
      case "between_24h_48h":
        return "Learner rescheduled within 24-48 hours.";
      case "under_24h":
        return isEmergency
          ? "Learner rescheduled within 24 hours with emergency flag. Manual review may apply."
          : "Learner rescheduled within 24 hours.";
      default:
        return "Learner rescheduled this booking.";
    }
  }

  private resolveMonthWindow(month?: string) {
    if (!month) {
      const now = new Date();
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0),
      );
      const monthEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0),
      );
      return { monthStart, monthEnd };
    }

    const [yearText, monthText] = month.split("-");
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    if (
      Number.isNaN(year) ||
      Number.isNaN(monthNumber) ||
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      throw new BadRequestException("Invalid month format. Use YYYY-MM");
    }
    const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0));
    return { monthStart, monthEnd };
  }

  private diffMinutes(startsAt: Date, endsAt: Date): number {
    return Math.max(
      15,
      Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
    );
  }

  private normaliseOptionalText(value?: string | null): string | null {
    if (typeof value !== "string") {
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
    const withoutInvalidChars = raw.replace(/[^0-9+]/g, "");
    const normalized = withoutInvalidChars.startsWith("+")
      ? `+${withoutInvalidChars.slice(1).replace(/\+/g, "")}`
      : withoutInvalidChars.replace(/\+/g, "");
    const digits = normalized.replace(/[^0-9]/g, "");
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
    if (typeof value !== "string") {
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
    return cleaned.replace(/[^0-9]/g, "");
  }

  private normaliseBankAccountNumber(value?: string | null): string | null {
    const cleaned = this.normaliseOptionalText(value);
    if (!cleaned) {
      return null;
    }
    return cleaned.replace(/[^0-9]/g, "");
  }

  private validateBankDetailsInput(
    holderName?: string | null,
    sortCode?: string | null,
    accountNumber?: string | null,
  ) {
    const normalizedHolder = this.normaliseOptionalText(holderName);
    const normalizedSortCode = this.normaliseBankSortCode(sortCode);
    const normalizedAccountNumber =
      this.normaliseBankAccountNumber(accountNumber);
    const anyProvided = Boolean(
      normalizedHolder || normalizedSortCode || normalizedAccountNumber,
    );
    if (!anyProvided) {
      return;
    }
    if (!normalizedHolder) {
      throw new BadRequestException("Bank account holder name is required");
    }
    if (!normalizedSortCode || !/^\d{6}$/.test(normalizedSortCode)) {
      throw new BadRequestException(
        "Bank sort code must contain exactly 6 digits",
      );
    }
    if (!normalizedAccountNumber || !/^\d{8}$/.test(normalizedAccountNumber)) {
      throw new BadRequestException(
        "Bank account number must contain exactly 8 digits",
      );
    }
  }

  private async loadLearnerLessonContext(
    learnerUserId: string,
    lessonId: string,
  ) {
    const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId } });
    if (!lesson || lesson.deletedAt) {
      throw new NotFoundException("Lesson not found");
    }
    if (lesson.learnerUserId !== learnerUserId) {
      throw new ForbiddenException(
        "Only the learner can manage lesson payment",
      );
    }
    const instructor = await this.instructorsRepo.findOne({
      where: { id: lesson.instructorId },
    });
    if (!instructor || instructor.deletedAt) {
      throw new NotFoundException("Instructor not found");
    }
    return { lesson, instructor };
  }

  private resolveLessonAmountPence(
    lesson: LessonEntity,
    instructor: InstructorEntity,
  ): number {
    const hourlyRate = instructor.hourlyRatePence;
    if (!hourlyRate || hourlyRate <= 0) {
      throw new BadRequestException(
        "Instructor hourly rate is missing for payment",
      );
    }
    if (!lesson.durationMinutes || lesson.durationMinutes <= 0) {
      throw new BadRequestException("Lesson duration is missing for payment");
    }
    const amountPence = Math.round((hourlyRate * lesson.durationMinutes) / 60);
    if (!Number.isFinite(amountPence) || amountPence <= 0) {
      throw new BadRequestException(
        "Unable to calculate lesson payment amount",
      );
    }
    return amountPence;
  }

  private requireStripeSecretKey(): string {
    const key = this.normaliseOptionalText(process.env.STRIPE_SECRET_KEY);
    if (!key) {
      throw new ServiceUnavailableException("Stripe payment is not configured");
    }
    return key;
  }

  private async postStripeForm(
    path: string,
    params: URLSearchParams,
    secret: string,
  ) {
    try {
      const response = await axios.post(
        `https://api.stripe.com/v1${path}`,
        params.toString(),
        {
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );
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
        typeof error.response?.data?.error?.message === "string"
          ? error.response?.data?.error?.message
          : error.message;
      if (statusCode >= 500) {
        return new InternalServerErrorException(
          `Stripe error: ${stripeMessage}`,
        );
      }
      return new BadRequestException(`Stripe error: ${stripeMessage}`);
    }
    return new InternalServerErrorException("Stripe request failed");
  }

  private mapLessonWithFinance(
    lesson: LessonEntity,
    finance: LessonFinanceSnapshotEntity | null,
  ) {
    return {
      ...lesson,
      finance: this.mapLessonFinanceSnapshot(finance, lesson.id),
    };
  }

  private mapLessonFinanceSnapshot(
    finance: LessonFinanceSnapshotEntity | null | undefined,
    lessonId: string,
  ) {
    if (!finance) {
      return {
        lessonId,
        financeIntegrityStatus: "missing",
      };
    }
    return {
      id: finance.id,
      lessonId: finance.lessonId,
      currencyCode: finance.currencyCode,
      bookingSource: finance.bookingSource,
      grossAmountPence: finance.grossAmountPence,
      commissionPercentBasisPoints: finance.commissionPercentBasisPoints,
      commissionAmountPence: finance.commissionAmountPence,
      instructorNetAmountPence: finance.instructorNetAmountPence,
      commissionStatus: finance.commissionStatus,
      payoutStatus: finance.payoutStatus,
      financeIntegrityStatus: finance.financeIntegrityStatus,
      financeNotes: finance.financeNotes,
      snapshotVersion: finance.snapshotVersion,
      updatedAt: finance.updatedAt,
    };
  }

  private mapFinanceFromLessonRow(row: {
    id?: string | null;
    finance_id?: string | null;
    finance_booking_source?: LessonFinanceBookingSource | null;
    finance_currency_code?: string | null;
    finance_gross_amount_pence?: number | null;
    finance_commission_percent_basis_points?: number | null;
    finance_commission_amount_pence?: number | null;
    finance_instructor_net_amount_pence?: number | null;
    finance_commission_status?: string | null;
    finance_payout_status?: string | null;
    finance_integrity_status?: string | null;
    finance_notes?: string | null;
    finance_snapshot_version?: number | null;
    finance_updated_at?: Date | null;
  }) {
    if (!row.finance_id) {
      return {
        lessonId: row.id,
        financeIntegrityStatus: "missing",
      };
    }
    return {
      id: row.finance_id,
      lessonId: row.id,
      bookingSource: row.finance_booking_source,
      currencyCode: row.finance_currency_code,
      grossAmountPence:
        row.finance_gross_amount_pence !== null
          ? Number(row.finance_gross_amount_pence)
          : null,
      commissionPercentBasisPoints:
        row.finance_commission_percent_basis_points !== null
          ? Number(row.finance_commission_percent_basis_points)
          : null,
      commissionAmountPence:
        row.finance_commission_amount_pence !== null
          ? Number(row.finance_commission_amount_pence)
          : null,
      instructorNetAmountPence:
        row.finance_instructor_net_amount_pence !== null
          ? Number(row.finance_instructor_net_amount_pence)
          : null,
      commissionStatus: row.finance_commission_status,
      payoutStatus: row.finance_payout_status,
      financeIntegrityStatus: row.finance_integrity_status ?? "synced",
      financeNotes: row.finance_notes ?? null,
      snapshotVersion:
        row.finance_snapshot_version !== null
          ? Number(row.finance_snapshot_version)
          : null,
      updatedAt: row.finance_updated_at ?? null,
    };
  }

  private toStatusCountMap(rows: Array<Record<string, unknown>>) {
    return rows.reduce<Record<string, number>>((acc, row) => {
      const status = String(row.status ?? "unknown");
      acc[status] = Number(row.count ?? 0);
      return acc;
    }, {});
  }

  private resolveAdminDateRange(from?: string, to?: string) {
    if (!from && !to) {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: start.toISOString(), to: end.toISOString() };
    }

    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to) : new Date();
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException("Invalid finance report date range");
    }
    if (toDate <= fromDate) {
      throw new BadRequestException("Finance report date range is invalid");
    }
    return { from: fromDate.toISOString(), to: toDate.toISOString() };
  }

  private limitFinanceErrorNote(error: unknown) {
    const message = this.errorMessage(error);
    if (message.length <= 480) {
      return message;
    }
    return `${message.slice(0, 477)}...`;
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return String(error);
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
      ? "suspended"
      : profile.isApproved
        ? "approved"
        : "pending";

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

  private mapInstructorLearnerLink(link: InstructorLearnerLinkEntity) {
    return {
      id: link.id,
      status: link.status,
      requestedAt: link.requestedAt,
      approvedAt: link.approvedAt,
      instructorId: link.instructorId,
      instructorName: link.instructor?.fullName ?? null,
      learnerUserId: link.learnerUserId,
      learnerName: link.learnerUser?.name ?? null,
      requestCode: link.requestCode,
    };
  }

  private resolvePendingReviewWindowDays() {
    const raw = Number(process.env.INSTRUCTOR_REVIEW_WINDOW_DAYS ?? 30);
    if (!Number.isFinite(raw)) {
      return 30;
    }
    return Math.max(1, Math.min(Math.round(raw), 365));
  }

  private resolveReviewCompletedAt(
    lesson: Pick<LessonEntity, "updatedAt" | "scheduledAt" | "createdAt">,
  ) {
    return (
      lesson.updatedAt ?? lesson.scheduledAt ?? lesson.createdAt ?? new Date()
    );
  }

  private async findReviewOrThrow(reviewId: string, withDeleted = false) {
    const review = await this.reviewsRepo.findOne({
      where: { id: reviewId },
      withDeleted,
    });
    if (!review) {
      throw new NotFoundException("Review not found");
    }
    return review;
  }

  private async updateReviewStatus(
    reviewId: string,
    nextStatus: InstructorReviewStatus,
    actorUserId?: string | null,
    moderationReason?: string,
  ) {
    const review = await this.findReviewOrThrow(reviewId, true);
    if (
      review.deletedAt &&
      review.status === "removed" &&
      nextStatus !== "visible"
    ) {
      throw new BadRequestException(
        "Removed review cannot be moderated further",
      );
    }

    const statusFrom = review.status;
    review.status = nextStatus;
    review.moderatedAt = new Date();
    review.moderatedByUserId = actorUserId ?? null;
    review.moderationReason = this.normaliseOptionalText(moderationReason);
    const saved = await this.reviewsRepo.save(review);

    if (nextStatus === "removed") {
      await this.reviewsRepo.softDelete(review.id);
      saved.deletedAt = new Date();
    }

    const actionByStatus: Record<InstructorReviewStatus, string> = {
      pending: "INSTRUCTOR_REVIEW_UPDATED",
      visible: "INSTRUCTOR_REVIEW_RESTORED",
      flagged: "INSTRUCTOR_REVIEW_FLAGGED",
      hidden: "INSTRUCTOR_REVIEW_HIDDEN",
      removed: "INSTRUCTOR_REVIEW_REMOVED",
    };
    await this.recordReviewAuditEvent(
      actionByStatus[nextStatus],
      actorUserId ?? null,
      saved,
      {
        statusFrom,
        statusTo: nextStatus,
        moderationReason: saved.moderationReason,
      },
    );
    return saved;
  }

  private async recordReviewAuditEvent(
    action: string,
    actorUserId: string | null,
    review: Pick<
      InstructorReviewEntity,
      | "id"
      | "lessonId"
      | "instructorId"
      | "learnerUserId"
      | "rating"
      | "status"
      | "reportedCount"
      | "deletedAt"
    >,
    metadata: Record<string, unknown>,
  ) {
    await this.auditRepo.save({
      userId: actorUserId,
      action,
      metadata: {
        reviewId: review.id,
        lessonId: review.lessonId,
        instructorId: review.instructorId,
        learnerUserId: review.learnerUserId,
        rating: review.rating,
        status: review.status,
        reportedCount: review.reportedCount ?? 0,
        deletedAt: review.deletedAt ? review.deletedAt.toISOString() : null,
        ...metadata,
      },
    });
  }

  private async enrichAdminReviews(reviews: InstructorReviewEntity[]) {
    if (!reviews.length) {
      return [];
    }

    const instructorIds = Array.from(
      new Set(reviews.map((review) => review.instructorId)),
    );
    const learnerIds = Array.from(
      new Set(reviews.map((review) => review.learnerUserId)),
    );
    const lessonIds = Array.from(
      new Set(reviews.map((review) => review.lessonId)),
    );

    const [instructors, learners, lessons] = await Promise.all([
      instructorIds.length
        ? this.instructorsRepo.find({ where: { id: In(instructorIds) } })
        : [],
      learnerIds.length
        ? this.usersRepo.find({
            where: { id: In(learnerIds) },
            select: ["id", "name", "email"],
          })
        : [],
      lessonIds.length
        ? this.lessonsRepo.find({ where: { id: In(lessonIds) } })
        : [],
    ]);

    const instructorById = new Map(
      instructors.map((instructor) => [instructor.id, instructor]),
    );
    const learnerById = new Map(
      learners.map((learner) => [learner.id, learner]),
    );
    const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

    return reviews.map((review) => {
      const instructor = instructorById.get(review.instructorId);
      const learner = learnerById.get(review.learnerUserId);
      const lesson = lessonById.get(review.lessonId);
      return {
        id: review.id,
        lessonId: review.lessonId,
        instructorId: review.instructorId,
        instructorName: instructor?.fullName ?? null,
        learnerUserId: review.learnerUserId,
        learnerName: learner?.name ?? null,
        learnerEmail: learner?.email ?? null,
        rating: review.rating,
        reviewText: review.reviewText,
        status: review.status,
        reportedCount: review.reportedCount ?? 0,
        lastReportedReasonCode: review.lastReportedReasonCode,
        lastReportedNote: review.lastReportedNote,
        lastReportedAt: review.lastReportedAt,
        moderationReason: review.moderationReason,
        moderatedByUserId: review.moderatedByUserId,
        moderatedAt: review.moderatedAt,
        lessonStatus: lesson?.status ?? null,
        lessonScheduledAt: lesson?.scheduledAt ?? null,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        deletedAt: review.deletedAt,
      };
    });
  }

  private requireRole(
    user: AuthenticatedRequestUser,
    expectedRole: "learner" | "instructor",
  ) {
    const resolvedRole = normaliseRole(user.role);
    if (resolvedRole !== expectedRole) {
      throw new ForbiddenException(
        `Only ${expectedRole}s can perform this action`,
      );
    }
  }

  private toPoint(
    lat: number | null | undefined,
    lng: number | null | undefined,
  ): { type: "Point"; coordinates: [number, number] } | null {
    if (lat === undefined && lng === undefined) {
      return null;
    }
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {
      return null;
    }
    return { type: "Point", coordinates: [lng, lat] };
  }

  private async createInstructorShareCode(
    instructorId: string,
    now: Date,
    manager?: EntityManager,
  ) {
    const shareCodeRepo =
      manager?.getRepository(InstructorShareCodeEntity) ??
      this.instructorShareCodeRepo;
    const code = await this.generateUniqueShareCode(now, manager);
    return shareCodeRepo.save(
      shareCodeRepo.create({
        instructorId,
        code,
        isActive: true,
        expiresAt: null,
      }),
    );
  }

  private async generateUniqueShareCode(now: Date, manager?: EntityManager) {
    const shareCodeRepo =
      manager?.getRepository(InstructorShareCodeEntity) ??
      this.instructorShareCodeRepo;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const existing = await shareCodeRepo
        .createQueryBuilder("code")
        .where("code.code = :code", { code })
        .andWhere("code.is_active = true")
        .andWhere("(code.expires_at IS NULL OR code.expires_at > :now)", {
          now,
        })
        .getOne();
      if (!existing) {
        return code;
      }
    }
    throw new BadRequestException(
      "Unable to generate a unique instructor code",
    );
  }
}
