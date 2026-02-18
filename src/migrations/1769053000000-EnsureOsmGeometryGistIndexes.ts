import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureOsmGeometryGistIndexes1769053000000
  implements MigrationInterface
{
  name = 'EnsureOsmGeometryGistIndexes1769053000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        tbl text;
        geom_col text;
        idx_name text;
      BEGIN
        FOREACH tbl IN ARRAY ARRAY['planet_osm_point', 'planet_osm_line', 'planet_osm_polygon']
        LOOP
          IF to_regclass('public.' || tbl) IS NOT NULL THEN
            SELECT a.attname
            INTO geom_col
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_type t ON t.oid = a.atttypid
            WHERE n.nspname = 'public'
              AND c.relname = tbl
              AND a.attnum > 0
              AND NOT a.attisdropped
              AND t.typname = 'geometry'
            ORDER BY
              CASE a.attname
                WHEN 'way' THEN 0
                WHEN 'geom' THEN 1
                WHEN 'geometry' THEN 2
                WHEN 'wkb_geometry' THEN 3
                ELSE 100
              END ASC,
              a.attnum ASC
            LIMIT 1;

            IF geom_col IS NOT NULL THEN
              idx_name := 'idx_' || tbl || '_' || geom_col || '_gist';
              EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON public.%I USING GIST (%I)',
                idx_name,
                tbl,
                geom_col
              );
            END IF;
          END IF;
        END LOOP;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        tbl text;
        candidate_col text;
        idx_name text;
      BEGIN
        FOREACH tbl IN ARRAY ARRAY['planet_osm_point', 'planet_osm_line', 'planet_osm_polygon']
        LOOP
          FOREACH candidate_col IN ARRAY ARRAY['way', 'geom', 'geometry', 'wkb_geometry']
          LOOP
            idx_name := 'idx_' || tbl || '_' || candidate_col || '_gist';
            EXECUTE format('DROP INDEX IF EXISTS %I', idx_name);
          END LOOP;
        END LOOP;
      END
      $$;
    `);
  }
}
