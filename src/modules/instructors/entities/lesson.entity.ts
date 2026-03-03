import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InstructorEntity } from './instructor.entity';
import { User } from '../../../entities/user.entity';
import { InstructorReviewEntity } from './instructor-review.entity';

export type LessonStatus = 'planned' | 'completed' | 'cancelled';

@Entity({ name: 'lessons' })
export class LessonEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'instructor_id', type: 'uuid' })
  instructorId: string;

  @ManyToOne(() => InstructorEntity, (instructor) => instructor.lessons)
  @JoinColumn({ name: 'instructor_id' })
  instructor: InstructorEntity;

  @Column({ name: 'learner_user_id', type: 'uuid' })
  learnerUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'learner_user_id' })
  learnerUser: User;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number | null;

  @Column({ name: 'status', type: 'text', default: 'planned' })
  status: LessonStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => InstructorReviewEntity, (review) => review.lesson)
  reviews: InstructorReviewEntity[];
}
