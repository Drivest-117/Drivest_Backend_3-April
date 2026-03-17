import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { UserModuleProgress } from '../../entities/user-module-progress.entity';
import { UserModulePassStatus } from '../../entities/user-module-pass-status.entity';
import { UserAnalyticsRollup } from '../../entities/user-analytics-rollup.entity';
import {
  ANALYTICS_MODULE_KEYS,
  ModulePassStatusUpsertDto,
  ModuleProgressUpsertDto,
  ModuleRollupUpsertDto,
  SyncAnalyticsDto,
} from './dto/sync-analytics.dto';
import { InstructorEntity } from '../instructors/entities/instructor.entity';
import { LessonEntity } from '../instructors/entities/lesson.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserModuleProgress)
    private readonly moduleProgressRepo: Repository<UserModuleProgress>,
    @InjectRepository(UserModulePassStatus)
    private readonly modulePassStatusRepo: Repository<UserModulePassStatus>,
    @InjectRepository(UserAnalyticsRollup)
    private readonly analyticsRollupRepo: Repository<UserAnalyticsRollup>,
    @InjectRepository(InstructorEntity)
    private readonly instructorsRepo: Repository<InstructorEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonsRepo: Repository<LessonEntity>,
  ) {}

  async syncForUser(userId: string, dto: SyncAnalyticsDto) {
    await this.upsertModuleProgress(userId, dto.moduleProgress ?? []);
    await this.upsertModulePassStatus(userId, dto.modulePassStatuses ?? []);
    await this.upsertModuleRollups(userId, dto.moduleRollups ?? []);
    return this.getMySummary(userId);
  }

  async getMySummary(userId: string) {
    const [progressRows, passRows, rollupRows] = await Promise.all([
      this.moduleProgressRepo.find({
        where: { userId },
        order: { moduleKey: 'ASC', language: 'ASC', updatedAt: 'DESC' },
      }),
      this.modulePassStatusRepo.find({
        where: { userId },
        order: { moduleKey: 'ASC', updatedAt: 'DESC' },
      }),
      this.analyticsRollupRepo.find({
        where: { userId },
        order: { moduleKey: 'ASC', updatedAt: 'DESC' },
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      moduleProgress: progressRows.map((row) => ({
        moduleKey: row.moduleKey,
        language: row.language,
        completionPercent: row.completionPercent,
        bookmarks: row.bookmarks ?? [],
        wrongQueue: row.wrongQueue ?? [],
        metadata: row.metadata ?? {},
        lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })),
      modulePassStatus: passRows.map((row) => ({
        moduleKey: row.moduleKey,
        passed: row.passed,
        passedAt: row.passedAt?.toISOString() ?? null,
        source: row.source,
        metadata: row.metadata ?? {},
        updatedAt: row.updatedAt.toISOString(),
      })),
      moduleRollups: rollupRows.map((row) => ({
        moduleKey: row.moduleKey,
        quizzesCompleted: row.quizzesCompleted,
        questionsAnswered: row.questionsAnswered,
        correctAnswers: row.correctAnswers,
        bestScorePercent: row.bestScorePercent,
        lastScorePercent: row.lastScorePercent,
        practiceStarted: row.practiceStarted,
        practiceCompleted: row.practiceCompleted,
        navigationStarted: row.navigationStarted,
        navigationCompleted: row.navigationCompleted,
        completedRouteIds: row.completedRouteIds ?? [],
        metadata: row.metadata ?? {},
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }

  async getInstructorLearnerAnalytics(
    requesterUserId: string,
    requesterRole: string | undefined,
    instructorId?: string,
  ) {
    const normalizedRole = String(requesterRole ?? '').toUpperCase();
    if (normalizedRole !== 'INSTRUCTOR' && normalizedRole !== 'ADMIN') {
      throw new ForbiddenException('Instructor or admin role is required');
    }

    const targetInstructorId =
      normalizedRole === 'ADMIN'
        ? this.normalizeInstructorId(instructorId)
        : await this.resolveInstructorIdForUser(requesterUserId);

    const lessonRows = await this.queryLearnerLessonStats(targetInstructorId);
    const learnerIds = lessonRows.map((row) => row.learnerUserId);
    if (!learnerIds.length) {
      return {
        generatedAt: new Date().toISOString(),
        instructorId: targetInstructorId,
        learners: [],
      };
    }

    const [learners, passRows, rollupRows] = await Promise.all([
      this.usersRepo.find({
        where: { id: In(learnerIds) },
        select: ['id', 'name', 'email', 'role'],
      }),
      this.modulePassStatusRepo.find({ where: { userId: In(learnerIds) } }),
      this.analyticsRollupRepo.find({ where: { userId: In(learnerIds) } }),
    ]);

    const learnerById = new Map(learners.map((learner) => [learner.id, learner]));
    const passByUser = new Map<string, UserModulePassStatus[]>();
    const rollupsByUser = new Map<string, UserAnalyticsRollup[]>();

    for (const row of passRows) {
      if (!passByUser.has(row.userId)) passByUser.set(row.userId, []);
      passByUser.get(row.userId)!.push(row);
    }

    for (const row of rollupRows) {
      if (!rollupsByUser.has(row.userId)) rollupsByUser.set(row.userId, []);
      rollupsByUser.get(row.userId)!.push(row);
    }

    return {
      generatedAt: new Date().toISOString(),
      instructorId: targetInstructorId,
      learners: lessonRows.map((row) => {
        const learner = learnerById.get(row.learnerUserId);
        const passStatuses = passByUser.get(row.learnerUserId) ?? [];
        const rollups = rollupsByUser.get(row.learnerUserId) ?? [];
        return {
          learnerUserId: row.learnerUserId,
          learnerName: learner?.name ?? 'Learner',
          learnerEmail: learner?.email ?? null,
          lessonStats: {
            total: row.lessonTotal,
            completed: row.completed,
            accepted: row.accepted,
            requested: row.requested,
            declined: row.declined,
            cancelled: row.cancelled,
          },
          passStatus: passStatuses.map((item) => ({
            moduleKey: item.moduleKey,
            passed: item.passed,
            passedAt: item.passedAt?.toISOString() ?? null,
            source: item.source,
          })),
          rollups: rollups.map((item) => ({
            moduleKey: item.moduleKey,
            quizzesCompleted: item.quizzesCompleted,
            questionsAnswered: item.questionsAnswered,
            correctAnswers: item.correctAnswers,
            bestScorePercent: item.bestScorePercent,
            lastScorePercent: item.lastScorePercent,
            practiceStarted: item.practiceStarted,
            practiceCompleted: item.practiceCompleted,
            navigationStarted: item.navigationStarted,
            navigationCompleted: item.navigationCompleted,
            completedRouteIds: item.completedRouteIds ?? [],
            updatedAt: item.updatedAt.toISOString(),
          })),
        };
      }),
    };
  }

  async getAdminOverview() {
    const [totalUsers, roleCounts, instructorProfiles, lessonCounts, progressUsers, rollupUsers] =
      await Promise.all([
        this.usersRepo.count(),
        this.usersRepo
          .createQueryBuilder('u')
          .select('COALESCE(u.role, \'USER\')', 'role')
          .addSelect('COUNT(*)', 'count')
          .groupBy('u.role')
          .getRawMany<{ role: string; count: string }>(),
        this.instructorsRepo.count(),
        this.lessonsRepo
          .createQueryBuilder('l')
          .select('COUNT(*)', 'total')
          .addSelect(
            "SUM(CASE WHEN l.status = 'completed' THEN 1 ELSE 0 END)",
            'completed',
          )
          .getRawOne<{ total: string; completed: string }>(),
        this.moduleProgressRepo
          .createQueryBuilder('p')
          .select('COUNT(DISTINCT p.user_id)', 'count')
          .getRawOne<{ count: string }>(),
        this.analyticsRollupRepo
          .createQueryBuilder('r')
          .select('COUNT(DISTINCT r.user_id)', 'count')
          .getRawOne<{ count: string }>(),
      ]);

    const passRates = await this.modulePassStatusRepo
      .createQueryBuilder('p')
      .select('p.module_key', 'module_key')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN p.passed THEN 1 ELSE 0 END)', 'passed')
      .groupBy('p.module_key')
      .orderBy('p.module_key', 'ASC')
      .getRawMany<{ module_key: string; total: string; passed: string }>();

    const moduleEngagement = await this.analyticsRollupRepo
      .createQueryBuilder('r')
      .select('r.module_key', 'module_key')
      .addSelect('SUM(r.questions_answered)', 'questions_answered')
      .addSelect('SUM(r.quizzes_completed)', 'quizzes_completed')
      .addSelect(
        'SUM(r.practice_completed + r.navigation_completed)',
        'sessions_completed',
      )
      .groupBy('r.module_key')
      .orderBy('r.module_key', 'ASC')
      .getRawMany<{
        module_key: string;
        questions_answered: string;
        quizzes_completed: string;
        sessions_completed: string;
      }>();

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        users: totalUsers,
        userRoles: roleCounts.map((row) => ({
          role: row.role ?? 'USER',
          count: Number(row.count ?? 0),
        })),
        instructorProfiles,
        lessons: {
          total: Number(lessonCounts?.total ?? 0),
          completed: Number(lessonCounts?.completed ?? 0),
        },
        usersWithModuleProgress: Number(progressUsers?.count ?? 0),
        usersWithRollups: Number(rollupUsers?.count ?? 0),
      },
      modulePassRates: passRates.map((row) => {
        const total = Number(row.total ?? 0);
        const passed = Number(row.passed ?? 0);
        return {
          moduleKey: row.module_key,
          total,
          passed,
          passRatePercent: total > 0 ? Math.round((passed / total) * 100) : 0,
        };
      }),
      moduleEngagement: moduleEngagement.map((row) => ({
        moduleKey: row.module_key,
        questionsAnswered: Number(row.questions_answered ?? 0),
        quizzesCompleted: Number(row.quizzes_completed ?? 0),
        sessionsCompleted: Number(row.sessions_completed ?? 0),
      })),
    };
  }

  private async upsertModuleProgress(
    userId: string,
    rows: ModuleProgressUpsertDto[],
  ) {
    for (const row of rows) {
      const moduleKey = this.normalizeModuleKey(row.moduleKey);
      const language = this.normalizeLanguage(row.language);
      let entity = await this.moduleProgressRepo.findOne({
        where: { userId, moduleKey, language },
      });
      if (!entity) {
        entity = this.moduleProgressRepo.create({
          userId,
          moduleKey,
          language,
          completionPercent: 0,
          bookmarks: [],
          wrongQueue: [],
          metadata: {},
          lastActivityAt: null,
        });
      }
      if (row.completionPercent != null) {
        entity.completionPercent = this.clampPercent(row.completionPercent);
      }
      if (row.bookmarks != null) {
        entity.bookmarks = this.normalizeStringList(row.bookmarks);
      }
      if (row.wrongQueue != null) {
        entity.wrongQueue = this.normalizeStringList(row.wrongQueue);
      }
      if (row.lastActivityAt != null) {
        entity.lastActivityAt = this.toDateOrNull(row.lastActivityAt);
      }
      if (row.metadata != null) {
        entity.metadata = row.metadata;
      }
      await this.moduleProgressRepo.save(entity);
    }
  }

  private async upsertModulePassStatus(
    userId: string,
    rows: ModulePassStatusUpsertDto[],
  ) {
    for (const row of rows) {
      const moduleKey = this.normalizeModuleKey(row.moduleKey);
      let entity = await this.modulePassStatusRepo.findOne({
        where: { userId, moduleKey },
      });
      if (!entity) {
        entity = this.modulePassStatusRepo.create({
          userId,
          moduleKey,
          passed: false,
          passedAt: null,
          source: 'app',
          metadata: {},
        });
      }
      entity.passed = Boolean(row.passed);
      if (row.passedAt != null) {
        entity.passedAt = this.toDateOrNull(row.passedAt);
      } else if (row.passed && !entity.passedAt) {
        entity.passedAt = new Date();
      } else if (!row.passed) {
        entity.passedAt = null;
      }
      if (row.source != null) {
        entity.source = this.normalizeSource(row.source);
      }
      if (row.metadata != null) {
        entity.metadata = row.metadata;
      }
      await this.modulePassStatusRepo.save(entity);
    }
  }

  private async upsertModuleRollups(userId: string, rows: ModuleRollupUpsertDto[]) {
    for (const row of rows) {
      const moduleKey = this.normalizeModuleKey(row.moduleKey);
      let entity = await this.analyticsRollupRepo.findOne({
        where: { userId, moduleKey },
      });
      if (!entity) {
        entity = this.analyticsRollupRepo.create({
          userId,
          moduleKey,
          quizzesCompleted: 0,
          questionsAnswered: 0,
          correctAnswers: 0,
          bestScorePercent: 0,
          lastScorePercent: 0,
          practiceStarted: 0,
          practiceCompleted: 0,
          navigationStarted: 0,
          navigationCompleted: 0,
          completedRouteIds: [],
          metadata: {},
        });
      }

      if (row.quizzesCompleted != null) {
        entity.quizzesCompleted = this.clampNonNegative(row.quizzesCompleted);
      }
      if (row.questionsAnswered != null) {
        entity.questionsAnswered = this.clampNonNegative(row.questionsAnswered);
      }
      if (row.correctAnswers != null) {
        entity.correctAnswers = this.clampNonNegative(row.correctAnswers);
      }
      if (row.bestScorePercent != null) {
        entity.bestScorePercent = this.clampPercent(row.bestScorePercent);
      }
      if (row.lastScorePercent != null) {
        entity.lastScorePercent = this.clampPercent(row.lastScorePercent);
      }
      if (row.practiceStarted != null) {
        entity.practiceStarted = this.clampNonNegative(row.practiceStarted);
      }
      if (row.practiceCompleted != null) {
        entity.practiceCompleted = this.clampNonNegative(row.practiceCompleted);
      }
      if (row.navigationStarted != null) {
        entity.navigationStarted = this.clampNonNegative(row.navigationStarted);
      }
      if (row.navigationCompleted != null) {
        entity.navigationCompleted = this.clampNonNegative(row.navigationCompleted);
      }
      if (row.completedRouteIds != null) {
        entity.completedRouteIds = this.normalizeStringList(row.completedRouteIds);
      }
      if (row.metadata != null) {
        entity.metadata = row.metadata;
      }
      await this.analyticsRollupRepo.save(entity);
    }
  }

  private normalizeModuleKey(raw: string): string {
    const moduleKey = String(raw ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    if (!(ANALYTICS_MODULE_KEYS as readonly string[]).includes(moduleKey)) {
      throw new BadRequestException(
        `Unsupported moduleKey "${raw}". Allowed values: ${ANALYTICS_MODULE_KEYS.join(
          ', ',
        )}`,
      );
    }
    return moduleKey;
  }

  private normalizeLanguage(raw?: string): string {
    const value = String(raw ?? 'und')
      .trim()
      .toLowerCase();
    if (!value) return 'und';
    return value.slice(0, 16);
  }

  private normalizeSource(raw: string): string {
    const value = String(raw).trim();
    if (!value) return 'app';
    return value.slice(0, 64);
  }

  private normalizeStringList(values: string[]): string[] {
    const deduped = new Set<string>();
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (!normalized) continue;
      deduped.add(normalized);
    }
    return Array.from(deduped);
  }

  private toDateOrNull(value: string): Date | null {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private clampPercent(value: number): number {
    return Math.max(0, Math.min(100, Math.round(Number(value))));
  }

  private clampNonNegative(value: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.round(numeric));
  }

  private normalizeInstructorId(instructorId?: string): string | null {
    const normalized = String(instructorId ?? '').trim();
    return normalized.length === 0 ? null : normalized;
  }

  private async resolveInstructorIdForUser(userId: string): Promise<string> {
    const instructor = await this.instructorsRepo.findOne({
      where: { userId },
      select: ['id', 'userId'],
    });
    if (!instructor) {
      throw new ForbiddenException('Instructor profile not found');
    }
    return instructor.id;
  }

  private async queryLearnerLessonStats(instructorId: string | null) {
    const qb = this.lessonsRepo
      .createQueryBuilder('l')
      .select('l.learner_user_id', 'learner_user_id')
      .addSelect('COUNT(*)', 'lesson_total')
      .addSelect(
        "SUM(CASE WHEN l.status = 'completed' THEN 1 ELSE 0 END)",
        'completed',
      )
      .addSelect(
        "SUM(CASE WHEN l.status = 'accepted' THEN 1 ELSE 0 END)",
        'accepted',
      )
      .addSelect(
        "SUM(CASE WHEN l.status = 'requested' THEN 1 ELSE 0 END)",
        'requested',
      )
      .addSelect(
        "SUM(CASE WHEN l.status = 'declined' THEN 1 ELSE 0 END)",
        'declined',
      )
      .addSelect(
        "SUM(CASE WHEN l.status = 'cancelled' THEN 1 ELSE 0 END)",
        'cancelled',
      )
      .where('l.deleted_at IS NULL');

    if (instructorId) {
      qb.andWhere('l.instructor_id = :instructorId', { instructorId });
    }

    const rows = await qb
      .groupBy('l.learner_user_id')
      .orderBy('MAX(l.updated_at)', 'DESC')
      .getRawMany<{
        learner_user_id: string;
        lesson_total: string;
        completed: string;
        accepted: string;
        requested: string;
        declined: string;
        cancelled: string;
      }>();

    return rows.map((row) => ({
      learnerUserId: row.learner_user_id,
      lessonTotal: Number(row.lesson_total ?? 0),
      completed: Number(row.completed ?? 0),
      accepted: Number(row.accepted ?? 0),
      requested: Number(row.requested ?? 0),
      declined: Number(row.declined ?? 0),
      cancelled: Number(row.cancelled ?? 0),
    }));
  }
}
