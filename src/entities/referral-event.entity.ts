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

export enum ReferralEventState {
  CAPTURED = 'Captured',
  QUALIFIED = 'Qualified',
  HELD = 'Held',
  RELEASED = 'Released',
  BLOCKED = 'Blocked',
  REVERSED = 'Reversed',
}

export enum ReferralType {
  I2L = 'I2L',
  I2I = 'I2I',
  L2L = 'L2L',
  L2I = 'L2I',
}

@Entity({ name: 'referral_events' })
@Index('IDX_referral_events_user_id', ['userId'])
@Index('IDX_referral_events_referrer_id', ['referrerId'])
@Index('IDX_referral_events_state', ['state'])
export class ReferralEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'referrer_id', type: 'uuid' })
  referrerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @Column({ type: 'varchar' })
  referralType: ReferralType;

  @Column({
    type: 'varchar',
    default: ReferralEventState.CAPTURED,
  })
  state: ReferralEventState;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'int', default: 0 })
  fraudScore: number;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}
