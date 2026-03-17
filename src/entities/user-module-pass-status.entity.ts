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

@Entity({ name: 'user_module_pass_status' })
@Unique('UQ_user_module_pass_status_user_module', ['userId', 'moduleKey'])
@Index('IDX_user_module_pass_status_user_module', ['userId', 'moduleKey'])
export class UserModulePassStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'module_key', type: 'varchar', length: 64 })
  moduleKey: string;

  @Column({ type: 'boolean', default: false })
  passed: boolean;

  @Column({ name: 'passed_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  passedAt: Date | null;

  @Column({ type: 'varchar', length: 64, default: 'app' })
  source: string;

  @Column({ type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}
