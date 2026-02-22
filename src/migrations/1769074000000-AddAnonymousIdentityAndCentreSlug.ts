import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnonymousIdentityAndCentreSlug1769074000000
  implements MigrationInterface
{
  name = 'AddAnonymousIdentityAndCentreSlug1769074000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "appUserId" character varying`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_appUserId" ON "users" ("appUserId") WHERE "appUserId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "test_centres" ADD COLUMN IF NOT EXISTS "slug" character varying`,
    );

    await queryRunner.query(`
      WITH slug_seed AS (
        SELECT
          id,
          CASE
            WHEN COALESCE(BTRIM("slug"), '') <> '' THEN LOWER(BTRIM("slug"))
            ELSE LOWER(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(COALESCE(name, ''), '[^A-Za-z0-9]+', '-', 'g'),
                  '(^-+|-+$)',
                  '',
                  'g'
                ),
                '-{2,}',
                '-',
                'g'
              )
            )
          END AS slug_base
        FROM "test_centres"
      ),
      slug_ranked AS (
        SELECT
          id,
          slug_base,
          ROW_NUMBER() OVER (
            PARTITION BY slug_base
            ORDER BY id
          ) AS slug_rank
        FROM slug_seed
      )
      UPDATE "test_centres" tc
      SET "slug" = CASE
        WHEN sr.slug_rank = 1 THEN sr.slug_base
        ELSE sr.slug_base || '-' || sr.slug_rank::text
      END
      FROM slug_ranked sr
      WHERE tc.id = sr.id
        AND sr.slug_base IS NOT NULL
        AND sr.slug_base <> '';
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_test_centres_slug" ON "test_centres" ("slug") WHERE "slug" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_test_centres_slug"`);
    await queryRunner.query(
      `ALTER TABLE "test_centres" DROP COLUMN IF EXISTS "slug"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_appUserId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "appUserId"`);
  }
}

