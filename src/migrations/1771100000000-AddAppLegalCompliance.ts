import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppLegalCompliance1771100000000 implements MigrationInterface {
  name = 'AddAppLegalCompliance1771100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "legal_document_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_type" text NOT NULL,
        "version" text NOT NULL,
        "title" text NOT NULL DEFAULT '',
        "content_hash" text NOT NULL,
        "published_at" timestamptz NOT NULL DEFAULT now(),
        "effective_at" timestamptz NOT NULL DEFAULT now(),
        "publication_timestamp" timestamptz NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_legal_document_versions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4()
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "document_type" text
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "version" text
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "title" text
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "content_hash" text
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "published_at" timestamptz DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "effective_at" timestamptz DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "publication_timestamp" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      UPDATE "legal_document_versions"
      SET "publication_timestamp" = COALESCE("publication_timestamp", "created_at", now())
      WHERE "publication_timestamp" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "legal_document_versions"
      SET
        "title" = COALESCE("title", initcap(replace("document_type", '_', ' '))),
        "published_at" = COALESCE("published_at", "publication_timestamp", "created_at", now()),
        "effective_at" = COALESCE("effective_at", "publication_timestamp", "created_at", now())
      WHERE
        "title" IS NULL OR
        "published_at" IS NULL OR
        "effective_at" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "legal_document_versions"
      SET "is_active" = COALESCE("is_active", false)
      WHERE "is_active" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ALTER COLUMN "publication_timestamp" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ALTER COLUMN "title" SET DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ALTER COLUMN "published_at" SET DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "legal_document_versions"
      ALTER COLUMN "effective_at" SET DEFAULT now()
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_legal_document_versions_type_version"
      ON "legal_document_versions"("document_type", "version")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_legal_document_versions_type_active_publication"
      ON "legal_document_versions"("document_type", "is_active", "publication_timestamp" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_legal_acceptances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NULL,
        "anonymous_session_id" text NULL,
        "document_type" text NOT NULL DEFAULT 'app_bundle',
        "document_version" text NOT NULL DEFAULT 'unknown',
        "legal_document_version_id" uuid NULL,
        "install_identifier" text NOT NULL,
        "terms_version" text NOT NULL,
        "privacy_version" text NOT NULL,
        "safety_version" text NOT NULL,
        "accepted_at" timestamptz NOT NULL DEFAULT now(),
        "acceptance_source" text NOT NULL DEFAULT 'onboarding',
        "source_screen" text NOT NULL,
        "platform" text NOT NULL,
        "app_version" text NULL,
        "device_id_or_install_id" text NULL,
        "ip_address_hash" text NULL,
        "ui_locale" text NULL,
        "evidence_snapshot_id" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_legal_acceptances_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_legal_acceptances_user" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4()
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "user_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "anonymous_session_id" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "document_type" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "document_version" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "legal_document_version_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "install_identifier" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "terms_version" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "privacy_version" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "safety_version" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "accepted_at" timestamptz DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "acceptance_source" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "source_screen" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "platform" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "app_version" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "device_id_or_install_id" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "ip_address_hash" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "ui_locale" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "evidence_snapshot_id" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      UPDATE "user_legal_acceptances"
      SET
        "document_type" = COALESCE("document_type", 'app_bundle'),
        "document_version" = COALESCE("document_version", 'unknown'),
        "install_identifier" = COALESCE("install_identifier", 'unknown'),
        "terms_version" = COALESCE("terms_version", 'unknown'),
        "privacy_version" = COALESCE("privacy_version", 'unknown'),
        "safety_version" = COALESCE("safety_version", 'unknown'),
        "accepted_at" = COALESCE("accepted_at", "created_at", now()),
        "acceptance_source" = COALESCE("acceptance_source", 'onboarding'),
        "source_screen" = COALESCE("source_screen", 'legacy'),
        "platform" = COALESCE("platform", 'unknown'),
        "device_id_or_install_id" = COALESCE("device_id_or_install_id", "install_identifier", 'unknown')
      WHERE
        "document_type" IS NULL OR
        "document_version" IS NULL OR
        "install_identifier" IS NULL OR
        "terms_version" IS NULL OR
        "privacy_version" IS NULL OR
        "safety_version" IS NULL OR
        "accepted_at" IS NULL OR
        "acceptance_source" IS NULL OR
        "source_screen" IS NULL OR
        "platform" IS NULL OR
        "device_id_or_install_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ALTER COLUMN "accepted_at" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ALTER COLUMN "document_type" SET DEFAULT 'app_bundle'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ALTER COLUMN "document_version" SET DEFAULT 'unknown'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_legal_acceptances"
      ALTER COLUMN "acceptance_source" SET DEFAULT 'onboarding'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_legal_acceptances_install_accepted_at"
      ON "user_legal_acceptances"("install_identifier", "accepted_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_legal_acceptances_user_accepted_at"
      ON "user_legal_acceptances"("user_id", "accepted_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_consents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NULL,
        "install_identifier" text NOT NULL,
        "consent_type" text NOT NULL,
        "choice" text NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "source_surface" text NOT NULL,
        "platform" text NOT NULL,
        "app_version" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_synced_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_consents_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_consents_user" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4()
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "user_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "install_identifier" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "consent_type" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "choice" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "source_surface" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "platform" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "app_version" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ADD COLUMN IF NOT EXISTS "last_synced_at" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      UPDATE "user_consents"
      SET
        "install_identifier" = COALESCE("install_identifier", 'unknown'),
        "consent_type" = COALESCE("consent_type", 'unknown'),
        "choice" = COALESCE("choice", 'unknown'),
        "updated_at" = COALESCE("updated_at", "created_at", now()),
        "source_surface" = COALESCE("source_surface", 'legacy'),
        "platform" = COALESCE("platform", 'unknown'),
        "last_synced_at" = COALESCE("last_synced_at", "updated_at", "created_at", now())
      WHERE
        "install_identifier" IS NULL OR
        "consent_type" IS NULL OR
        "choice" IS NULL OR
        "updated_at" IS NULL OR
        "source_surface" IS NULL OR
        "platform" IS NULL OR
        "last_synced_at" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "user_consents"
      ALTER COLUMN "updated_at" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_consents_install_type"
      ON "user_consents"("install_identifier", "consent_type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_consents_user_type"
      ON "user_consents"("user_id", "consent_type")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "consent_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NULL,
        "install_identifier" text NOT NULL,
        "consent_type" text NOT NULL,
        "choice" text NOT NULL,
        "changed_at" timestamptz NOT NULL DEFAULT now(),
        "source_surface" text NOT NULL,
        "platform" text NOT NULL,
        "app_version" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_consent_history_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_consent_history_user" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4()
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "user_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "install_identifier" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "consent_type" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "choice" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "changed_at" timestamptz DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "source_surface" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "platform" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "app_version" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      UPDATE "consent_history"
      SET
        "install_identifier" = COALESCE("install_identifier", 'unknown'),
        "consent_type" = COALESCE("consent_type", 'unknown'),
        "choice" = COALESCE("choice", 'unknown'),
        "changed_at" = COALESCE("changed_at", "created_at", now()),
        "source_surface" = COALESCE("source_surface", 'legacy'),
        "platform" = COALESCE("platform", 'unknown')
      WHERE
        "install_identifier" IS NULL OR
        "consent_type" IS NULL OR
        "choice" IS NULL OR
        "changed_at" IS NULL OR
        "source_surface" IS NULL OR
        "platform" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_history"
      ALTER COLUMN "changed_at" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_consent_history_install_type_changed"
      ON "consent_history"("install_identifier", "consent_type", "changed_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_consent_history_user_type_changed"
      ON "consent_history"("user_id", "consent_type", "changed_at" DESC)
    `);

    await queryRunner.query(`
      INSERT INTO "legal_document_versions" (
        "document_type",
        "version",
        "title",
        "content_hash",
        "published_at",
        "effective_at",
        "publication_timestamp",
        "is_active",
        "metadata"
      ) VALUES
      (
        'terms',
        '3.0',
        'Drivest Terms and Conditions',
        'dcb6875e1c23a3577366a2dd1bb30b476d555a92ba66cbc7e193084ae7861d91',
        '2026-03-24T00:00:00.000Z',
        '2026-03-24T00:00:00.000Z',
        '2026-03-24T00:00:00.000Z',
        true,
        '{"url":"https://www.drivest.uk/terms.html","title":"Drivest Terms and Conditions"}'::jsonb
      ),
      (
        'privacy',
        '3.0',
        'Drivest Privacy Policy',
        '6eae2b5bf2571e1a2f4738fc11d8dfb2502f57216288ad4f445486e64bd5e805',
        '2026-03-24T00:00:00.000Z',
        '2026-03-24T00:00:00.000Z',
        '2026-03-24T00:00:00.000Z',
        true,
        '{"url":"https://www.drivest.uk/privacypolicy.html","title":"Drivest Privacy Policy"}'::jsonb
      ),
      (
        'safety_notice',
        '2026-03-24.v1',
        'Drivest Safety Notice',
        '63da846f6eb4baaffbdefec0927fefb6cf148f47d44149b58d3549fc0b2125f6',
        '2026-03-24T00:00:00.000Z',
        '2026-03-24T00:00:00.000Z',
        '2026-03-24T00:00:00.000Z',
        true,
        '{"title":"Drivest Safety Notice","scope":"combined_onboarding_legal_screen"}'::jsonb
      )
      ON CONFLICT ("document_type", "version") DO UPDATE
      SET
        "title" = EXCLUDED."title",
        "content_hash" = EXCLUDED."content_hash",
        "published_at" = EXCLUDED."published_at",
        "effective_at" = EXCLUDED."effective_at",
        "publication_timestamp" = EXCLUDED."publication_timestamp",
        "is_active" = EXCLUDED."is_active",
        "metadata" = EXCLUDED."metadata"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "legal_document_versions"
      WHERE ("document_type", "version") IN (
        ('terms', '3.0'),
        ('privacy', '3.0'),
        ('safety_notice', '2026-03-24.v1')
      )
    `);
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_consent_history_user_type_changed"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_consent_history_install_type_changed"');
    await queryRunner.query('DROP TABLE IF EXISTS "consent_history"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_consents_user_type"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_user_consents_install_type"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_consents"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_legal_acceptances_user_accepted_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_legal_acceptances_install_accepted_at"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_legal_acceptances"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_legal_document_versions_type_active_publication"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_legal_document_versions_type_version"');
    await queryRunner.query('DROP TABLE IF EXISTS "legal_document_versions"');
  }
}
