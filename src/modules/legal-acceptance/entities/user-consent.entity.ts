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
import { DB_AWARE_JSON_TYPE, DB_AWARE_TIMESTAMP_TYPE } from '../../../database/db-column-types';
import { User } from '../../../entities/user.entity';
import { AppConsentType } from '../legal-acceptance.app.constants';

@Entity({ name: 'user_consents' })
@Index('UQ_user_consents_install_type', ['installIdentifier', 'consentType'], { unique: true })
@Index('IDX_user_consents_user_type', ['userId', 'consentType'])
export class UserConsentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'install_identifier', type: 'text' })
  installIdentifier: string;

  @Column({ name: 'consent_type', type: 'text' })
  consentType: AppConsentType;

  @Column({ name: 'choice', type: 'text' })
  choice: string;

  @Column({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;

  @Column({ name: 'source_surface', type: 'text' })
  sourceSurface: string;

  @Column({ name: 'platform', type: 'text' })
  platform: string;

  @Column({ name: 'app_version', type: 'text', nullable: true })
  appVersion: string | null;

  @Column({ name: 'metadata', type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'last_synced_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  lastSyncedAt: Date;
}

