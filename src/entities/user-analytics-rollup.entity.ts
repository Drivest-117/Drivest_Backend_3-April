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

@Entity({ name: 'user_analytics_rollup' })
@Unique('UQ_user_analytics_rollup_user_module', ['userId', 'moduleKey'])
@Index('IDX_user_analytics_rollup_user_module', ['userId', 'moduleKey'])
export class UserAnalyticsRollup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'module_key', type: 'varchar', length: 64 })
  moduleKey: string;

  @Column({ name: 'quizzes_completed', type: 'int', default: 0 })
  quizzesCompleted: number;

  @Column({ name: 'questions_answered', type: 'int', default: 0 })
  questionsAnswered: number;

  @Column({ name: 'correct_answers', type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ name: 'best_score_percent', type: 'int', default: 0 })
  bestScorePercent: number;

  @Column({ name: 'last_score_percent', type: 'int', default: 0 })
  lastScorePercent: number;

  @Column({ name: 'practice_started', type: 'int', default: 0 })
  practiceStarted: number;

  @Column({ name: 'practice_completed', type: 'int', default: 0 })
  practiceCompleted: number;

  @Column({ name: 'navigation_started', type: 'int', default: 0 })
  navigationStarted: number;

  @Column({ name: 'navigation_completed', type: 'int', default: 0 })
  navigationCompleted: number;

  @Column({ name: 'completed_route_ids', type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  completedRouteIds: string[] | null;

  @Column({ type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}
