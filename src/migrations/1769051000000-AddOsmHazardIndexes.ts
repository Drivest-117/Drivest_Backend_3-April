import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOsmHazardIndexes1769051000000 implements MigrationInterface {
  name = 'AddOsmHazardIndexes1769051000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS hstore');

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

        IF to_regclass('public.planet_osm_point') IS NOT NULL THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_planet_osm_point_highway ON public.planet_osm_point (highway)';
        END IF;

        IF to_regclass('public.planet_osm_line') IS NOT NULL THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_planet_osm_line_highway ON public.planet_osm_line (highway)';
        END IF;

        IF to_regclass('public.planet_osm_polygon') IS NOT NULL THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_planet_osm_polygon_amenity ON public.planet_osm_polygon (amenity)';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_point_way_gix');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_point_way_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_point_geom_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_point_geometry_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_point_wkb_geometry_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_point_highway');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_line_way_gix');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_line_way_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_line_geom_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_line_geometry_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_line_wkb_geometry_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_line_highway');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_polygon_way_gix');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_polygon_way_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_polygon_geom_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_polygon_geometry_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_polygon_wkb_geometry_gist');
    await queryRunner.query('DROP INDEX IF EXISTS idx_planet_osm_polygon_amenity');
  }
}
