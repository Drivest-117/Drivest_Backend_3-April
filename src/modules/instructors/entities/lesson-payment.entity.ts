import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LessonEntity } from './lesson.entity';
import { DB_AWARE_JSON_TYPE, DB_AWARE_TIMESTAMP_TYPE } from '../../../database/db-column-types';

export type LessonPaymentProvider = 'stripe' | 'apple_iap';
export type LessonPaymentStatus =
  | 'pending'
  | 'checkout_created'
  | 'captured'
  | 'failed'
  | 'cancelled';

@Entity({ name: 'lesson_payments' })
export class LessonPaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lesson_id', type: 'uuid', unique: true })
  lessonId: string;

  @OneToOne(() => LessonEntity)
  @JoinColumn({ name: 'lesson_id' })
  lesson: LessonEntity;

  @Column({ name: 'provider', type: 'text', default: 'stripe' })
  provider: LessonPaymentProvider;

  @Column({ name: 'status', type: 'text', default: 'pending' })
  status: LessonPaymentStatus;

  @Column({ name: 'currency_code', type: 'text', default: 'GBP' })
  currencyCode: string;

  @Column({ name: 'amount_pence', type: 'int', nullable: true })
  amountPence: number | null;

  @Column({ name: 'checkout_session_id', type: 'text', nullable: true })
  checkoutSessionId: string | null;

  @Column({ name: 'checkout_url', type: 'text', nullable: true })
  checkoutUrl: string | null;

  @Column({ name: 'payment_intent_id', type: 'text', nullable: true })
  paymentIntentId: string | null;

  @Column({ name: 'product_id', type: 'text', nullable: true })
  productId: string | null;

  @Column({ name: 'transaction_id', type: 'text', nullable: true, unique: true })
  transactionId: string | null;

  @Column({ name: 'captured_at', type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  capturedAt: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'raw_provider_payload', type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  rawProviderPayload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}
