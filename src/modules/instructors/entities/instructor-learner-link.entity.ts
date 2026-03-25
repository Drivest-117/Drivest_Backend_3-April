import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DB_AWARE_TIMESTAMP_TYPE } from '../../../database/db-column-types';
import { InstructorEntity } from './instructor.entity';
import { User } from '../../../entities/user.entity';

export enum InstructorLearnerLinkStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
}

@Entity({ name: 'instructor_learner_links' })
@Index('IDX_instructor_learner_links_instructor_status', ['instructorId', 'status'])
@Index('IDX_instructor_learner_links_learner_status', ['learnerUserId', 'status'])
@Index('UQ_instructor_learner_links_pair', ['instructorId', 'learnerUserId'], { unique: true })
export class InstructorLearnerLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'instructor_id', type: 'uuid' })
  instructorId: string;

  @ManyToOne(() => InstructorEntity, { nullable: false })
  @JoinColumn({ name: 'instructor_id' })
  instructor: InstructorEntity;

  @Column({ name: 'learner_user_id', type: 'uuid' })
  learnerUserId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'learner_user_id' })
  learnerUser: User;

  @Column({ name: 'status', type: 'text', default: InstructorLearnerLinkStatus.PENDING })
  status: InstructorLearnerLinkStatus;

  @Column({ name: 'request_code', type: 'text', nullable: true })
  requestCode: string | null;

  @Column({ name: 'requested_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  requestedAt: Date;

  @Column({ name: 'approved_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}
