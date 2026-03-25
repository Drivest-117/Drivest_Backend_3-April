import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNavigationAccess1770900000000 implements MigrationInterface {
  name = 'AddUserNavigationAccess1770900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "navigationAccessUntil" timestamptz NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "navigationAccessUntil"',
    );
  }
}
