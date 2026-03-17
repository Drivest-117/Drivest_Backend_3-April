import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCouncilTroDatasets1770200000000
  implements MigrationInterface
{
  name = 'AddCouncilTroDatasets1770200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "council_tro_features" (
        "id" text PRIMARY KEY,
        "source_id" text NOT NULL,
        "source_name" text NOT NULL,
        "authority_name" text NOT NULL,
        "dataset_url" text NOT NULL,
        "hazard_type" character varying NOT NULL,
        "label" text NULL,
        "geom" geometry(Geometry,4326) NOT NULL,
        "feature_point" geometry(Point,4326) NOT NULL,
        "properties" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "priority" integer NOT NULL DEFAULT 90,
        "confidence" double precision NOT NULL DEFAULT 0.95,
        "valid_from" TIMESTAMPTZ NULL,
        "valid_to" TIMESTAMPTZ NULL,
        "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_council_tro_source_active" ON "council_tro_features" ("source_id", "is_active")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_council_tro_hazard_active" ON "council_tro_features" ("hazard_type", "is_active")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_council_tro_valid_to" ON "council_tro_features" ("valid_to")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_council_tro_geom" ON "council_tro_features" USING GIST ("geom")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_council_tro_feature_point" ON "council_tro_features" USING GIST ("feature_point")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_council_tro_feature_point"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_council_tro_geom"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_council_tro_valid_to"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_council_tro_hazard_active"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_council_tro_source_active"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "council_tro_features"');
  }
}

