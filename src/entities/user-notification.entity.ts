import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { DB_AWARE_JSON_TYPE, DB_AWARE_TIMESTAMP_TYPE } from '../database/db-column-types';

export type UserNotificationCategory =
  | 'booking_request'
  | 'booking_status'
  | 'lesson_update'
  | 'practice_recommendation'
  | 'app_update'
  | 'admin_message';

@Entity({ name: 'user_notifications' })
export class UserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ name: 'category', type: 'text' })
  category: UserNotificationCategory;

  @Column({ name: 'title', type: 'text' })
  title: string;

  @Column({ name: 'body', type: 'text' })
  body: string;

  @Column({ name: 'payload', type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @Column({ name: 'read_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  readAt: Date | null;

  @DeleteDateColumn({ name: 'deleted_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  deletedAt: Date | null;
}
