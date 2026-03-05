import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAnonymousAppUserIdentity1769500000000
  implements MigrationInterface
{
  name = 'RemoveAnonymousAppUserIdentity1769500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_appUserId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "appUserId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "appUserId" character varying`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_appUserId" ON "users" ("appUserId") WHERE "appUserId" IS NOT NULL`,
    );
  }
}
