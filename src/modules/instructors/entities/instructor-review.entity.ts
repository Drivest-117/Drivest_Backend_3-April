import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { InstructorEntity } from './instructor.entity';
import { User } from '../../../entities/user.entity';
import { LessonEntity } from './lesson.entity';

export type InstructorReviewStatus = 'visible' | 'hidden' | 'removed';

@Entity({ name: 'instructor_reviews' })
@Unique('UQ_instructor_review_lesson', ['instructorId', 'learnerUserId', 'lessonId'])
@Check('CHK_instructor_reviews_rating_range', 'rating >= 1 AND rating <= 5')
export class InstructorReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'instructor_id', type: 'uuid' })
  instructorId: string;

  @ManyToOne(() => InstructorEntity, (instructor) => instructor.reviews)
  @JoinColumn({ name: 'instructor_id' })
  instructor: InstructorEntity;

  @Column({ name: 'learner_user_id', type: 'uuid' })
  learnerUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'learner_user_id' })
  learnerUser: User;

  @Column({ name: 'rating', type: 'int' })
  rating: number;

  @Column({ name: 'review_text', type: 'text', nullable: true })
  reviewText: string | null;

  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => LessonEntity, (lesson) => lesson.reviews)
  @JoinColumn({ name: 'lesson_id' })
  lesson: LessonEntity;

  @Column({ name: 'status', type: 'text', default: 'visible' })
  status: InstructorReviewStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
