import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DB_AWARE_JSON_TYPE, DB_AWARE_TIMESTAMP_TYPE } from '../database/db-column-types';

@Entity({ name: 'content_pack_manifest' })
@Unique('UQ_content_pack_manifest_identity', [
  'platform',
  'moduleKey',
  'contentKind',
  'language',
  'version',
])
@Index('IDX_content_pack_manifest_lookup', [
  'platform',
  'moduleKey',
  'contentKind',
  'language',
  'isActive',
  'publishedAt',
])
export class ContentPackManifest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 24, default: 'ios' })
  platform: string;

  @Column({ name: 'module_key', type: 'varchar', length: 64 })
  moduleKey: string;

  @Column({ name: 'content_kind', type: 'varchar', length: 64, default: 'default' })
  contentKind: string;

  @Column({ type: 'varchar', length: 16, default: 'en' })
  language: string;

  @Column({ type: 'varchar', length: 64 })
  version: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  hash: string | null;

  @Column({ name: 'size_bytes', type: 'integer', nullable: true })
  sizeBytes: number | null;

  @Column({ type: 'text' })
  url: string;

  @Column({ name: 'min_app_version', type: 'varchar', length: 32, nullable: true })
  minAppVersion: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  metadata: Record<string, unknown> | null;

  @Column({ name: 'published_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  publishedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}
