import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { DB_AWARE_TIMESTAMP_TYPE } from '../database/db-column-types';

@Entity({ name: 'referral_payouts' })
@Index('IDX_referral_payouts_referrer_id', ['referrerId'])
@Index('IDX_referral_payouts_referee_id', ['refereeId'])
export class ReferralPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'referrer_id', type: 'uuid' })
  referrerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @Column({ name: 'referee_id', type: 'uuid' })
  refereeId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referee_id' })
  referee: User;

  @Column({ type: 'int' })
  amountPence: number;

  @Column({ type: 'text', nullable: true })
  bookingId: string;

  @Column({ type: DB_AWARE_TIMESTAMP_TYPE } as any)
  expiryDate: Date;

  @Column({ type: 'boolean', default: false })
  isPaid: boolean;

  @Column({ type: DB_AWARE_TIMESTAMP_TYPE, nullable: true } as any)
  paidAt: Date | null;

  @CreateDateColumn({ type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}
