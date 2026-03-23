import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DB_AWARE_TIMESTAMP_TYPE } from '../../../database/db-column-types';
import { LessonEntity } from './lesson.entity';

export type LessonFinanceBookingSource = 'marketplace' | 'direct_instructor' | 'admin_created';
export type LessonFinanceCommissionStatus =
  | 'not_applicable'
  | 'estimated'
  | 'ready'
  | 'disputed'
  | 'voided';
export type LessonFinancePayoutStatus =
  | 'not_applicable'
  | 'pending'
  | 'on_hold'
  | 'ready_for_manual_payout'
  | 'marked_paid'
  | 'voided';
export type LessonFinanceIntegrityStatus = 'synced' | 'missing' | 'stale' | 'sync_failed';

@Entity({ name: 'lesson_finance_snapshots' })
@Index('UQ_lesson_finance_snapshots_lesson_id', ['lessonId'], { unique: true })
@Index('IDX_lesson_finance_snapshots_payout_status', ['payoutStatus'])
@Index('IDX_lesson_finance_snapshots_commission_status', ['commissionStatus'])
@Index('IDX_lesson_finance_snapshots_integrity_status', ['financeIntegrityStatus'])
export class LessonFinanceSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @OneToOne(() => LessonEntity, { nullable: false })
  @JoinColumn({ name: 'lesson_id' })
  lesson: LessonEntity;

  @Column({ name: 'currency_code', type: 'text', default: 'GBP' })
  currencyCode: string;

  @Column({ name: 'booking_source', type: 'text', default: 'marketplace' })
  bookingSource: LessonFinanceBookingSource;

  @Column({ name: 'gross_amount_pence', type: 'int', nullable: true })
  grossAmountPence: number | null;

  @Column({ name: 'commission_percent_basis_points', type: 'int', default: 800 })
  commissionPercentBasisPoints: number;

  @Column({ name: 'commission_amount_pence', type: 'int', nullable: true })
  commissionAmountPence: number | null;

  @Column({ name: 'instructor_net_amount_pence', type: 'int', nullable: true })
  instructorNetAmountPence: number | null;

  @Column({ name: 'commission_status', type: 'text', default: 'estimated' })
  commissionStatus: LessonFinanceCommissionStatus;

  @Column({ name: 'payout_status', type: 'text', default: 'pending' })
  payoutStatus: LessonFinancePayoutStatus;

  @Column({ name: 'finance_integrity_status', type: 'text', default: 'synced' })
  financeIntegrityStatus: LessonFinanceIntegrityStatus;

  @Column({ name: 'finance_notes', type: 'text', nullable: true })
  financeNotes: string | null;

  @Column({ name: 'snapshot_version', type: 'int', default: 1 })
  snapshotVersion: number;

  @Column({ name: 'external_payment_reference', type: 'text', nullable: true })
  externalPaymentReference: string | null;

  @Column({ name: 'external_payout_reference', type: 'text', nullable: true })
  externalPayoutReference: string | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}
