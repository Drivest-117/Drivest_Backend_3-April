import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOverpassAdvisoryCache1769800000000
  implements MigrationInterface
{
  name = 'AddOverpassAdvisoryCache1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "advisory_query_cache" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "query_key" text NOT NULL UNIQUE,
        "south" double precision NOT NULL,
        "west" double precision NOT NULL,
        "north" double precision NOT NULL,
        "east" double precision NOT NULL,
        "corridor_m" integer NOT NULL DEFAULT 220,
        "types" text[] NULL,
        "source_status" character varying NOT NULL DEFAULT 'ok',
        "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ NOT NULL,
        "overpass_snapshot" TIMESTAMPTZ NULL,
        "metadata" jsonb NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "advisory_features" (
        "id" text PRIMARY KEY,
        "osm_type" character varying NOT NULL,
        "osm_id" bigint NOT NULL,
        "hazard_type" character varying NOT NULL,
        "lat" double precision NOT NULL,
        "lon" double precision NOT NULL,
        "geom" geography(Point,4326) NOT NULL,
        "priority" integer NOT NULL,
        "confidence" double precision NOT NULL,
        "label" text NULL,
        "sign_title" text NULL,
        "sign_code" text NULL,
        "sign_image_path" text NULL,
        "source" character varying NOT NULL DEFAULT 'osm_overpass',
        "raw_tags" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "advisory_query_features" (
        "query_id" uuid NOT NULL,
        "feature_id" text NOT NULL,
        "dist_m" double precision NULL,
        CONSTRAINT "PK_advisory_query_features" PRIMARY KEY ("query_id", "feature_id"),
        CONSTRAINT "FK_advisory_query_features_query" FOREIGN KEY ("query_id") REFERENCES "advisory_query_cache"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_advisory_query_features_feature" FOREIGN KEY ("feature_id") REFERENCES "advisory_features"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "advisory_fetch_runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "query_key" text NOT NULL,
        "cache_hit" boolean NOT NULL DEFAULT false,
        "status" character varying NOT NULL,
        "duration_ms" integer NOT NULL DEFAULT 0,
        "fetched_count" integer NOT NULL DEFAULT 0,
        "error" text NULL,
        "metadata" jsonb NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_advisory_query_cache_expires" ON "advisory_query_cache" ("expires_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_advisory_query_cache_status" ON "advisory_query_cache" ("source_status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_advisory_features_geom" ON "advisory_features" USING GIST ("geom")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_advisory_features_osm_hazard" ON "advisory_features" ("osm_type", "osm_id", "hazard_type")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_advisory_features_hazard_expires" ON "advisory_features" ("hazard_type", "expires_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_advisory_query_features_feature" ON "advisory_query_features" ("feature_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_advisory_fetch_runs_query_created" ON "advisory_fetch_runs" ("query_key", "created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_advisory_fetch_runs_query_created"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_advisory_query_features_feature"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_advisory_features_hazard_expires"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_advisory_features_osm_hazard"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_advisory_features_geom"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_advisory_query_cache_status"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_advisory_query_cache_expires"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "advisory_fetch_runs"');
    await queryRunner.query('DROP TABLE IF EXISTS "advisory_query_features"');
    await queryRunner.query('DROP TABLE IF EXISTS "advisory_features"');
    await queryRunner.query('DROP TABLE IF EXISTS "advisory_query_cache"');
  }
}
