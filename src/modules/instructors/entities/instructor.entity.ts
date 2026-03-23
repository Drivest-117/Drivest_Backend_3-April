import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../entities/user.entity';
import { InstructorReviewEntity } from './instructor-review.entity';
import { LessonEntity } from './lesson.entity';
import { DB_AWARE_TIMESTAMP_TYPE } from '../../../database/db-column-types';

export type TransmissionType = 'manual' | 'automatic' | 'both';

@Entity({ name: 'instructors' })
export class InstructorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'full_name', type: 'text' })
  fullName: string;

  @Column({ name: 'email', type: 'text' })
  email: string;

  @Column({ name: 'phone', type: 'text', nullable: true })
  phone: string | null;

  @Column({ name: 'adi_number', type: 'text', unique: true })
  adiNumber: string;

  @Column({ name: 'profile_photo_url', type: 'text', nullable: true })
  profilePhotoUrl: string | null;

  @Column({ name: 'years_experience', type: 'int', nullable: true })
  yearsExperience: number | null;

  @Column({ name: 'transmission_type', type: 'text' })
  transmissionType: TransmissionType;

  @Column({ name: 'hourly_rate_pence', type: 'int', nullable: true })
  hourlyRatePence: number | null;

  @Column({ name: 'bio', type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'languages', type: 'text', array: true, nullable: true })
  languages: string[] | null;

  @Column({ name: 'coverage_postcodes', type: 'text', array: true, nullable: true })
  coveragePostcodes: string[] | null;

  @Column({ name: 'bank_account_holder_name', type: 'text', nullable: true })
  bankAccountHolderName: string | null;

  @Column({ name: 'bank_sort_code', type: 'text', nullable: true })
  bankSortCode: string | null;

  @Column({ name: 'bank_account_number', type: 'text', nullable: true })
  bankAccountNumber: string | null;

  @Column({ name: 'bank_name', type: 'text', nullable: true })
  bankName: string | null;

  @Column({
    name: 'home_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  homeLocation: { type: 'Point'; coordinates: [number, number] } | null;

  @Column({ name: 'is_approved', type: 'boolean', default: false })
  isApproved: boolean;

  @Column({ name: 'approved_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  approvedAt: Date | null;

  @Column({ name: 'suspended_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  suspendedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  deletedAt: Date | null;

  @OneToMany(() => InstructorReviewEntity, (review) => review.instructor)
  reviews: InstructorReviewEntity[];

  @OneToMany(() => LessonEntity, (lesson) => lesson.instructor)
  lessons: LessonEntity[];
}
