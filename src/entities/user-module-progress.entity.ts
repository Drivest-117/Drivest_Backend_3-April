import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { DB_AWARE_JSON_TYPE, DB_AWARE_TIMESTAMP_TYPE } from '../database/db-column-types';

@Entity({ name: 'user_module_progress' })
@Unique('UQ_user_module_progress_user_module_language', [
  'userId',
  'moduleKey',
  'language',
])
@Index('IDX_user_module_progress_user_module', ['userId', 'moduleKey'])
export class UserModuleProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'module_key', type: 'varchar', length: 64 })
  moduleKey: string;

  @Column({ type: 'varchar', length: 16, default: 'und' })
  language: string;

  @Column({ name: 'completion_percent', type: 'int', default: 0 })
  completionPercent: number;

  @Column({ type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  bookmarks: string[] | null;

  @Column({ name: 'wrong_queue', type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  wrongQueue: string[] | null;

  @Column({ type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  metadata: Record<string, unknown> | null;

  @Column({ name: 'last_activity_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  lastActivityAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}
