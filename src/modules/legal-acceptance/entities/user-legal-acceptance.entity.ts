import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DB_AWARE_JSON_TYPE, DB_AWARE_TIMESTAMP_TYPE } from '../../../database/db-column-types';
import { User } from '../../../entities/user.entity';

@Entity({ name: 'user_legal_acceptances' })
@Index('IDX_user_legal_acceptances_install_accepted_at', ['installIdentifier', 'acceptedAt'])
@Index('IDX_user_legal_acceptances_user_accepted_at', ['userId', 'acceptedAt'])
export class UserLegalAcceptanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'install_identifier', type: 'text' })
  installIdentifier: string;

  @Column({ name: 'terms_version', type: 'text' })
  termsVersion: string;

  @Column({ name: 'privacy_version', type: 'text' })
  privacyVersion: string;

  @Column({ name: 'safety_version', type: 'text' })
  safetyVersion: string;

  @Column({ name: 'accepted_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  acceptedAt: Date;

  @Column({ name: 'source_screen', type: 'text' })
  sourceScreen: string;

  @Column({ name: 'platform', type: 'text' })
  platform: string;

  @Column({ name: 'app_version', type: 'text', nullable: true })
  appVersion: string | null;

  @Column({ name: 'metadata', type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;
}

