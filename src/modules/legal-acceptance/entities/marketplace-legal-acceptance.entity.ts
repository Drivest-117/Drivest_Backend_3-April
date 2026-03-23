import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../../entities/user.entity';
import { DB_AWARE_JSON_TYPE, DB_AWARE_TIMESTAMP_TYPE } from '../../../database/db-column-types';
import { MarketplaceLegalSurface } from '../legal-acceptance.constants';

export type MarketplaceLegalAcceptanceRole = 'learner' | 'instructor';

@Entity({ name: 'marketplace_legal_acceptances' })
@Index('UQ_marketplace_legal_acceptances_user_surface_version', ['userId', 'surface', 'version'], {
  unique: true,
})
@Index('IDX_marketplace_legal_acceptances_user_surface_accepted_at', ['userId', 'surface', 'acceptedAt'])
export class MarketplaceLegalAcceptanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_role', type: 'text' })
  userRole: MarketplaceLegalAcceptanceRole;

  @Column({ name: 'surface', type: 'text' })
  surface: MarketplaceLegalSurface;

  @Column({ name: 'version', type: 'text' })
  version: string;

  @Column({ name: 'accepted_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  acceptedAt: Date;

  @Column({ name: 'metadata', type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;
}
