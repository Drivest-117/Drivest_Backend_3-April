import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketplaceLegalAcceptances1770700000000 implements MigrationInterface {
  name = 'AddMarketplaceLegalAcceptances1770700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_legal_acceptances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "user_role" text NOT NULL,
        "surface" text NOT NULL,
        "version" text NOT NULL,
        "accepted_at" timestamptz NOT NULL DEFAULT now(),
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketplace_legal_acceptances_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_marketplace_legal_acceptances_user" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketplace_legal_acceptances_user_surface_version"
      ON "marketplace_legal_acceptances"("user_id", "surface", "version")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketplace_legal_acceptances_user_surface_accepted_at"
      ON "marketplace_legal_acceptances"("user_id", "surface", "accepted_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketplace_legal_acceptances_surface_version"
      ON "marketplace_legal_acceptances"("surface", "version")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_marketplace_legal_acceptances_surface_version"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_marketplace_legal_acceptances_user_surface_accepted_at"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_marketplace_legal_acceptances_user_surface_version"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "marketplace_legal_acceptances"');
  }
}
