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

@Entity({ name: 'instructor_share_codes' })
@Index('IDX_instructor_share_codes_instructor_active', ['instructorId', 'isActive'])
@Index('IDX_instructor_share_codes_code_active', ['code', 'isActive'])
export class InstructorShareCodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'instructor_id', type: 'uuid' })
  instructorId: string;

  @ManyToOne(() => InstructorEntity, { nullable: false })
  @JoinColumn({ name: 'instructor_id' })
  instructor: InstructorEntity;

  @Column({ name: 'code', type: 'text' })
  code: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'expires_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}
