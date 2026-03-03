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
import { CreateInstructorProfileDto } from './dto/create-instructor-profile.dto';
import { UpdateInstructorProfileDto } from './dto/update-instructor-profile.dto';
import { ListInstructorsQueryDto } from './dto/list-instructors-query.dto';
import { AuthenticatedRequestUser, normaliseRole } from './instructors.types';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonStatusDto } from './dto/update-lesson-status.dto';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class InstructorsService {
  constructor(
    @InjectRepository(InstructorEntity)
    private readonly instructorsRepo: Repository<InstructorEntity>,
    @InjectRepository(InstructorReviewEntity)
    private readonly reviewsRepo: Repository<InstructorReviewEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonsRepo: Repository<LessonEntity>,
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
      coveragePostcodes: dto.coveragePostcodes?.map((pc) => pc.toUpperCase()) ?? null,
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
        dto.coveragePostcodes?.map((pc) => pc.toUpperCase()) ?? profile.coveragePostcodes,
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

    if (query.postcode) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM unnest(i.coverage_postcodes) AS pc
          WHERE upper(pc) = upper(:postcode)
        )`,
        { postcode: query.postcode },
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
    return this.instructorsRepo.save(profile);
  }

  async suspendInstructor(instructorId: string) {
    const profile = await this.instructorsRepo.findOne({ where: { id: instructorId } });
    if (!profile || profile.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }
    profile.suspendedAt = new Date();
    profile.isApproved = false;
    return this.instructorsRepo.save(profile);
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

    const instructor = await this.instructorsRepo.findOne({ where: { id: dto.instructorId } });
    if (!instructor || instructor.deletedAt) {
      throw new NotFoundException('Instructor not found');
    }
    if (!instructor.isApproved || instructor.suspendedAt) {
      throw new BadRequestException('Instructor is not available for lessons');
    }

    const lesson = this.lessonsRepo.create({
      instructorId: dto.instructorId,
      learnerUserId: user.userId,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      durationMinutes: dto.durationMinutes ?? null,
      status: 'planned',
    });

    return this.lessonsRepo.save(lesson);
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

    lesson.status = dto.status;
    return this.lessonsRepo.save(lesson);
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

    return this.reviewsRepo.save(review);
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
