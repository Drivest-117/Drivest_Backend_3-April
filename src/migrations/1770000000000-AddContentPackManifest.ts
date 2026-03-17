import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContentPackManifest1770000000000 implements MigrationInterface {
  name = 'AddContentPackManifest1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content_pack_manifest" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "platform" character varying(24) NOT NULL DEFAULT 'ios',
        "module_key" character varying(64) NOT NULL,
        "content_kind" character varying(64) NOT NULL DEFAULT 'default',
        "language" character varying(16) NOT NULL DEFAULT 'en',
        "version" character varying(64) NOT NULL,
        "hash" character varying(128) NULL,
        "size_bytes" integer NULL,
        "url" text NOT NULL,
        "min_app_version" character varying(32) NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb NULL,
        "published_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_content_pack_manifest_identity"
      ON "content_pack_manifest" (
        "platform",
        "module_key",
        "content_kind",
        "language",
        "version"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_content_pack_manifest_lookup"
      ON "content_pack_manifest" (
        "platform",
        "module_key",
        "content_kind",
        "language",
        "is_active",
        "published_at"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_content_pack_manifest_platform_active"
      ON "content_pack_manifest" ("platform", "is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_content_pack_manifest_platform_active"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_content_pack_manifest_lookup"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_content_pack_manifest_identity"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "content_pack_manifest"');
  }
}
