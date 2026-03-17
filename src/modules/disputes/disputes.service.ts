import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';
import { InstructorEntity } from '../instructors/entities/instructor.entity';
import { LessonEntity } from '../instructors/entities/lesson.entity';
import { normaliseRole } from '../instructors/instructors.types';
import { AddDisputeEvidenceDto } from './dto/add-dispute-evidence.dto';
import { CreateDisputeCaseDto } from './dto/create-dispute-case.dto';
import { ListDisputeCasesQueryDto } from './dto/list-dispute-cases-query.dto';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto';
import {
  DisputeCaseEntity,
  DisputePartyRole,
  DisputeStatus,
} from './entities/dispute-case.entity';

interface AuthenticatedRequestUser {
  userId: string;
  role?: string;
}

interface LessonContext {
  lesson: LessonEntity;
  instructorUserId: string;
}

const TERMINAL_DISPUTE_STATUSES: DisputeStatus[] = ['resolved', 'closed'];

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(DisputeCaseEntity)
    private readonly disputesRepo: Repository<DisputeCaseEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonsRepo: Repository<LessonEntity>,
    @InjectRepository(InstructorEntity)
    private readonly instructorsRepo: Repository<InstructorEntity>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async openCase(actor: AuthenticatedRequestUser, dto: CreateDisputeCaseDto) {
    const actorRole = this.requireActorRole(actor.role);
    const lessonContext = dto.lessonId ? await this.loadLessonContext(dto.lessonId) : null;

    let againstUserId = dto.againstUserId ?? null;
    let againstRole = dto.againstRole ?? null;

    if (lessonContext) {
      const participants = this.resolveParticipantsFromLesson(actor.userId, actorRole, lessonContext);
      againstUserId = participants.againstUserId;
      againstRole = participants.againstRole;
    } else if (!againstUserId || !againstRole) {
      throw new BadRequestException(
        'againstUserId and againstRole are required when lessonId is not provided',
      );
    }

    if (againstUserId === actor.userId) {
      throw new BadRequestException('Cannot open a dispute against yourself');
    }

    if (!againstUserId || !againstRole) {
      throw new BadRequestException('Against party details are invalid');
    }

    await this.ensureUserExists(againstUserId);

    const now = new Date();
    const firstResponseBy = this.addHours(now, this.firstResponseSlaHours());
    const resolutionTargetBy = this.addHours(now, this.resolutionTargetSlaHours());

    const evidenceEntries = this.buildEvidenceEntries(actor.userId, actorRole, {
      note: dto.initialNote,
      links: dto.evidenceLinks,
    });

    const dispute = this.disputesRepo.create({
      lessonId: lessonContext?.lesson.id ?? null,
      openedByUserId: actor.userId,
      openedByRole: actorRole,
      againstUserId,
      againstRole,
      category: dto.category ?? 'booking',
      title: dto.title,
      description: dto.description,
      status: 'opened',
      priority: dto.priority ?? 'normal',
      firstResponseBy,
      resolutionTargetBy,
      respondedAt: null,
      resolvedAt: null,
      closedAt: null,
      lastActorUserId: actor.userId,
      latestNote: dto.initialNote ?? null,
      evidence: evidenceEntries,
    });

    const saved = await this.disputesRepo.save(dispute);

    await this.auditRepo.save({
      userId: actor.userId,
      action: 'DISPUTE_CASE_OPENED',
      metadata: {
        disputeCaseId: saved.id,
        lessonId: saved.lessonId,
        openedByRole: actorRole,
        againstUserId: saved.againstUserId,
        againstRole: saved.againstRole,
        category: saved.category,
        priority: saved.priority,
        status: saved.status,
        firstResponseBy: saved.firstResponseBy?.toISOString() ?? null,
        resolutionTargetBy: saved.resolutionTargetBy?.toISOString() ?? null,
      },
    });

    return saved;
  }

  async listCases(actor: AuthenticatedRequestUser, query: ListDisputeCasesQueryDto) {
    const actorRole = this.requireActorRole(actor.role);
    const qb = this.disputesRepo
      .createQueryBuilder('d')
      .where('d.deletedAt IS NULL')
      .orderBy('d.createdAt', 'DESC')
      .limit(query.limit ?? 50);

    if (query.status) {
      qb.andWhere('d.status = :status', { status: query.status });
    }

    if (actorRole !== 'admin') {
      qb.andWhere('(d.openedByUserId = :userId OR d.againstUserId = :userId)', {
        userId: actor.userId,
      });
    }

    if (query.overdueOnly) {
      qb.andWhere('d.status NOT IN (:...terminalStatuses)', {
        terminalStatuses: TERMINAL_DISPUTE_STATUSES,
      }).andWhere(
        '((d.respondedAt IS NULL AND d.firstResponseBy < :now) OR (d.resolvedAt IS NULL AND d.resolutionTargetBy < :now))',
        { now: new Date() },
      );
    }

    return qb.getMany();
  }

  async getCaseById(actor: AuthenticatedRequestUser, disputeCaseId: string) {
    const actorRole = this.requireActorRole(actor.role);
    const disputeCase = await this.disputesRepo.findOne({
      where: { id: disputeCaseId, deletedAt: IsNull() },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    this.ensureCaseAccess(disputeCase, actor.userId, actorRole);
    return disputeCase;
  }

  async updateStatusAsAdmin(
    actor: AuthenticatedRequestUser,
    disputeCaseId: string,
    dto: UpdateDisputeStatusDto,
  ) {
    const actorRole = this.requireActorRole(actor.role);
    if (actorRole !== 'admin') {
      throw new ForbiddenException('Only admins can update dispute status');
    }

    const disputeCase = await this.disputesRepo.findOne({
      where: { id: disputeCaseId, deletedAt: IsNull() },
    });
    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    const previousStatus = disputeCase.status;
    const now = new Date();
    disputeCase.status = dto.status;

    if (!disputeCase.respondedAt) {
      disputeCase.respondedAt = now;
    }
    if (dto.status === 'resolved') {
      disputeCase.resolvedAt = now;
    }
    if (dto.status === 'closed') {
      disputeCase.closedAt = now;
      disputeCase.resolvedAt = disputeCase.resolvedAt ?? now;
    }
    if (dto.note) {
      disputeCase.latestNote = dto.note;
    }
    if (dto.resolutionTargetBy) {
      disputeCase.resolutionTargetBy = new Date(dto.resolutionTargetBy);
    }
    disputeCase.lastActorUserId = actor.userId;

    const saved = await this.disputesRepo.save(disputeCase);

    await this.auditRepo.save({
      userId: actor.userId,
      action: 'DISPUTE_CASE_STATUS_UPDATED',
      metadata: {
        disputeCaseId: saved.id,
        previousStatus,
        nextStatus: saved.status,
        respondedAt: saved.respondedAt?.toISOString() ?? null,
        resolvedAt: saved.resolvedAt?.toISOString() ?? null,
        closedAt: saved.closedAt?.toISOString() ?? null,
        resolutionTargetBy: saved.resolutionTargetBy?.toISOString() ?? null,
      },
    });

    return saved;
  }

  async addEvidence(
    actor: AuthenticatedRequestUser,
    disputeCaseId: string,
    dto: AddDisputeEvidenceDto,
  ) {
    const actorRole = this.requireActorRole(actor.role);
    const disputeCase = await this.disputesRepo.findOne({
      where: { id: disputeCaseId, deletedAt: IsNull() },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    this.ensureCaseAccess(disputeCase, actor.userId, actorRole);

    const evidenceEntries = this.buildEvidenceEntries(actor.userId, actorRole, {
      note: dto.note,
      links: dto.links,
    }) ?? [];

    disputeCase.evidence = [...(disputeCase.evidence ?? []), ...evidenceEntries];
    disputeCase.latestNote = dto.note;
    disputeCase.lastActorUserId = actor.userId;
    if (disputeCase.status === 'awaiting_evidence') {
      disputeCase.status = 'triage';
    }

    const saved = await this.disputesRepo.save(disputeCase);
    await this.auditRepo.save({
      userId: actor.userId,
      action: 'DISPUTE_CASE_EVIDENCE_ADDED',
      metadata: {
        disputeCaseId: saved.id,
        actorRole,
        evidenceCount: evidenceEntries.length,
        status: saved.status,
      },
    });

    return saved;
  }

  private ensureCaseAccess(
    disputeCase: DisputeCaseEntity,
    actorUserId: string,
    actorRole: DisputePartyRole,
  ) {
    if (actorRole === 'admin') return;
    const allowedUserIds = [disputeCase.openedByUserId, disputeCase.againstUserId].filter(Boolean);
    if (!allowedUserIds.includes(actorUserId)) {
      throw new ForbiddenException('You do not have access to this dispute case');
    }
  }

  private async loadLessonContext(lessonId: string): Promise<LessonContext> {
    const lesson = await this.lessonsRepo.findOne({ where: { id: lessonId, deletedAt: IsNull() } });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const instructor = await this.instructorsRepo.findOne({
      where: { id: lesson.instructorId, deletedAt: IsNull() },
    });
    if (!instructor) {
      throw new BadRequestException('Instructor profile not found for lesson');
    }

    return {
      lesson,
      instructorUserId: instructor.userId,
    };
  }

  private resolveParticipantsFromLesson(
    actorUserId: string,
    actorRole: DisputePartyRole,
    context: LessonContext,
  ) {
    if (actorRole === 'learner') {
      if (context.lesson.learnerUserId !== actorUserId) {
        throw new ForbiddenException('Only the learner who booked this lesson can open a dispute');
      }
      return {
        againstUserId: context.instructorUserId,
        againstRole: 'instructor' as const,
      };
    }

    if (actorRole === 'instructor') {
      if (context.instructorUserId !== actorUserId) {
        throw new ForbiddenException('Only the assigned instructor can open a dispute');
      }
      return {
        againstUserId: context.lesson.learnerUserId,
        againstRole: 'learner' as const,
      };
    }

    return {
      againstUserId: context.lesson.learnerUserId,
      againstRole: 'learner' as const,
    };
  }

  private buildEvidenceEntries(
    actorUserId: string,
    actorRole: DisputePartyRole,
    payload: { note?: string; links?: string[] },
  ): Array<Record<string, unknown>> | null {
    const note = payload.note?.trim();
    const links = payload.links?.map((item) => item.trim()).filter(Boolean) ?? [];

    if (!note && links.length === 0) {
      return null;
    }

    return [
      {
        submittedAt: new Date().toISOString(),
        submittedByUserId: actorUserId,
        submittedByRole: actorRole,
        note: note ?? null,
        links,
      },
    ];
  }

  private requireActorRole(role: string | undefined): DisputePartyRole {
    const normalized = normaliseRole(role);
    if (!normalized) {
      throw new ForbiddenException('Unsupported role for dispute workflow');
    }
    return normalized;
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId, deletedAt: IsNull() } });
    if (!user) {
      throw new BadRequestException('Against user not found');
    }
  }

  private firstResponseSlaHours(): number {
    const raw = Number(process.env.DISPUTE_SLA_FIRST_RESPONSE_HOURS ?? 24);
    if (!Number.isFinite(raw) || raw <= 0) return 24;
    return Math.floor(raw);
  }

  private resolutionTargetSlaHours(): number {
    const raw = Number(process.env.DISPUTE_SLA_RESOLUTION_HOURS ?? 120);
    if (!Number.isFinite(raw) || raw <= 0) return 120;
    return Math.floor(raw);
  }

  private addHours(base: Date, hours: number): Date {
    return new Date(base.getTime() + hours * 60 * 60 * 1000);
  }
}
