import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonReferralFinanceColumns1771400000000
  implements MigrationInterface
{
  name = 'AddLessonReferralFinanceColumns1771400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "commission_rate_applied" numeric(5,2) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "referral_stake_payout_id" uuid NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "lessons" DROP COLUMN IF EXISTS "referral_stake_payout_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "lessons" DROP COLUMN IF EXISTS "commission_rate_applied"',
    );
  }
}
