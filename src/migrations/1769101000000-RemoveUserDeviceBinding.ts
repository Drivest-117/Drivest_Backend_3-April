import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUserDeviceBinding1769101000000 implements MigrationInterface {
  name = 'RemoveUserDeviceBinding1769101000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "activeDeviceId"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "activeDeviceAt"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeDeviceId" character varying');
    await queryRunner.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeDeviceAt" TIMESTAMP WITH TIME ZONE');
  }
}
