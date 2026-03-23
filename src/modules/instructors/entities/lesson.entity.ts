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
import { DB_AWARE_TIMESTAMP_TYPE } from '../../../database/db-column-types';

export type LessonStatus = 'planned' | 'requested' | 'accepted' | 'declined' | 'completed' | 'cancelled';

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

  @Column({ name: 'scheduled_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  scheduledAt: Date | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number | null;

  @Column({ name: 'status', type: 'text', default: 'planned' })
  status: LessonStatus;

  @Column({ name: 'availability_slot_id', type: 'uuid', nullable: true })
  availabilitySlotId: string | null;

  @Column({ name: 'learner_note', type: 'text', nullable: true })
  learnerNote: string | null;

  @Column({ name: 'pickup_address', type: 'text', nullable: true })
  pickupAddress: string | null;

  @Column({ name: 'pickup_postcode', type: 'text', nullable: true })
  pickupPostcode: string | null;

  @Column({ name: 'pickup_lat', type: 'double precision', nullable: true })
  pickupLat: number | null;

  @Column({ name: 'pickup_lng', type: 'double precision', nullable: true })
  pickupLng: number | null;

  @Column({ name: 'pickup_place_id', type: 'text', nullable: true })
  pickupPlaceId: string | null;

  @Column({ name: 'pickup_note', type: 'text', nullable: true })
  pickupNote: string | null;

  @Column({ name: 'pickup_contact_number', type: 'text', nullable: true })
  pickupContactNumber: string | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  deletedAt: Date | null;

  @OneToMany(() => InstructorReviewEntity, (review) => review.lesson)
  reviews: InstructorReviewEntity[];
}
