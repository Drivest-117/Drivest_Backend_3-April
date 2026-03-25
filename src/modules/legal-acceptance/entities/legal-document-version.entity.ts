import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DB_AWARE_JSON_TYPE, DB_AWARE_TIMESTAMP_TYPE } from '../../../database/db-column-types';
import { AppLegalDocumentType } from '../legal-acceptance.app.constants';

@Entity({ name: 'legal_document_versions' })
@Index('UQ_legal_document_versions_type_version', ['documentType', 'version'], { unique: true })
@Index('IDX_legal_document_versions_type_active_publication', ['documentType', 'isActive', 'publicationTimestamp'])
export class LegalDocumentVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_type', type: 'text' })
  documentType: AppLegalDocumentType;

  @Column({ name: 'version', type: 'text' })
  version: string;

  @Column({ name: 'content_hash', type: 'text' })
  contentHash: string;

  @Column({ name: 'publication_timestamp', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  publicationTimestamp: Date;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'metadata', type: DB_AWARE_JSON_TYPE, nullable: true } as any)
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DB_AWARE_TIMESTAMP_TYPE } as any)
  updatedAt: Date;
}

