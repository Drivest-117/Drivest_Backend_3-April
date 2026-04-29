import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralRewardSupportColumns1771500000000
  implements MigrationInterface
{
  name = 'AddReferralRewardSupportColumns1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "lesson_credit_balance_pence" int NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lesson_credit_granted_total_pence" int NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "entitlements"
      ADD COLUMN IF NOT EXISTS "source_referral_event_id" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "referral_payouts"
      ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP WITH TIME ZONE NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_entitlements_source_referral_event_id"
      ON "entitlements" ("source_referral_event_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_entitlements_source_referral_event_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "referral_payouts" DROP COLUMN IF EXISTS "paidAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "entitlements" DROP COLUMN IF EXISTS "source_referral_event_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "lesson_credit_granted_total_pence"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "lesson_credit_balance_pence"',
    );
  }
}
