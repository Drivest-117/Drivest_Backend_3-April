import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DB_AWARE_JSON_TYPE, DB_AWARE_TIMESTAMP_TYPE } from '../../../database/db-column-types';
import { LessonEntity } from '../../instructors/entities/lesson.entity';
import { User } from '../../../entities/user.entity';

export type DisputeStatus = 'opened' | 'triage' | 'awaiting_evidence' | 'resolved' | 'closed';
export type DisputePriority = 'low' | 'normal' | 'high' | 'urgent';
export type DisputeCategory = 'booking' | 'payment' | 'safety' | 'conduct' | 'other';
export type DisputePartyRole = 'learner' | 'instructor' | 'admin';

@Entity({ name: 'dispute_cases' })
export class DisputeCaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
  lessonId: string | null;

  @ManyToOne(() => LessonEntity, { nullable: true })
  @JoinColumn({ name: 'lesson_id' })
  lesson: LessonEntity | null;

  @Column({ name: 'opened_by_user_id', type: 'uuid' })
  openedByUserId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'opened_by_user_id' })
  openedByUser: User;

  @Column({ name: 'opened_by_role', type: 'text' })
  openedByRole: DisputePartyRole;

  @Column({ name: 'against_user_id', type: 'uuid', nullable: true })
  againstUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'against_user_id' })
  againstUser: User | null;

  @Column({ name: 'against_role', type: 'text', nullable: true })
  againstRole: DisputePartyRole | null;

  @Column({ name: 'category', type: 'text', default: 'booking' })
  category: DisputeCategory;

  @Column({ name: 'title', type: 'text' })
  title: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'status', type: 'text', default: 'opened' })
  status: DisputeStatus;

  @Column({ name: 'priority', type: 'text', default: 'normal' })
  priority: DisputePriority;

  @Column({ name: 'first_response_by', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  firstResponseBy: Date;

  @Column({ name: 'resolution_target_by', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  resolutionTargetBy: Date;

  @Column({ name: 'responded_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  respondedAt: Date | null;

  @Column({ name: 'resolved_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  resolvedAt: Date | null;

  @Column({ name: 'closed_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  closedAt: Date | null;

  @Column({ name: 'last_actor_user_id', type: 'uuid', nullable: true })
  lastActorUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'last_actor_user_id' })
  lastActorUser: User | null;

  @Column({ name: 'latest_note', type: 'text', nullable: true })
  latestNote: string | null;

  @Column({ name: 'evidence', type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  evidence: Array<Record<string, unknown>> | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  deletedAt: Date | null;
}
