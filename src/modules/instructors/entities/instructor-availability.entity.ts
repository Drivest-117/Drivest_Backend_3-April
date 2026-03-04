import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InstructorEntity } from './instructor.entity';
import { LessonEntity } from './lesson.entity';

export type InstructorAvailabilityStatus = 'open' | 'booked' | 'cancelled';

@Entity({ name: 'instructor_availability_slots' })
export class InstructorAvailabilityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'instructor_id', type: 'uuid' })
  instructorId: string;

  @ManyToOne(() => InstructorEntity)
  @JoinColumn({ name: 'instructor_id' })
  instructor: InstructorEntity;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Column({ name: 'status', type: 'text', default: 'open' })
  status: InstructorAvailabilityStatus;

  @Column({ name: 'booked_lesson_id', type: 'uuid', nullable: true })
  bookedLessonId: string | null;

  @OneToOne(() => LessonEntity, { nullable: true })
  @JoinColumn({ name: 'booked_lesson_id' })
  bookedLesson: LessonEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
