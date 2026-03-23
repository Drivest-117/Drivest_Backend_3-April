import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonFinanceSnapshots1770800000000 implements MigrationInterface {
  name = 'AddLessonFinanceSnapshots1770800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_finance_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lesson_id" uuid NOT NULL,
        "currency_code" text NOT NULL DEFAULT 'GBP',
        "booking_source" text NOT NULL DEFAULT 'marketplace',
        "gross_amount_pence" int NULL,
        "commission_percent_basis_points" int NOT NULL DEFAULT 800,
        "commission_amount_pence" int NULL,
        "instructor_net_amount_pence" int NULL,
        "commission_status" text NOT NULL DEFAULT 'estimated',
        "payout_status" text NOT NULL DEFAULT 'pending',
        "finance_integrity_status" text NOT NULL DEFAULT 'synced',
        "finance_notes" text NULL,
        "snapshot_version" int NOT NULL DEFAULT 1,
        "external_payment_reference" text NULL,
        "external_payout_reference" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_finance_snapshots_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lesson_finance_snapshots_lesson_id" UNIQUE ("lesson_id"),
        CONSTRAINT "FK_lesson_finance_snapshots_lesson" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
      )
    `);

    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "currency_code" text NOT NULL DEFAULT \'GBP\'',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "booking_source" text NOT NULL DEFAULT \'marketplace\'',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "gross_amount_pence" int NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "commission_percent_basis_points" int NOT NULL DEFAULT 800',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "commission_amount_pence" int NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "instructor_net_amount_pence" int NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "commission_status" text NOT NULL DEFAULT \'estimated\'',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "payout_status" text NOT NULL DEFAULT \'pending\'',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "finance_integrity_status" text NOT NULL DEFAULT \'synced\'',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "finance_notes" text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "snapshot_version" int NOT NULL DEFAULT 1',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "external_payment_reference" text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lesson_finance_snapshots" ADD COLUMN IF NOT EXISTS "external_payout_reference" text NULL',
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lesson_finance_snapshots_commission_status"
      ON "lesson_finance_snapshots"("commission_status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lesson_finance_snapshots_payout_status"
      ON "lesson_finance_snapshots"("payout_status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lesson_finance_snapshots_integrity_status"
      ON "lesson_finance_snapshots"("finance_integrity_status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_lesson_finance_snapshots_integrity_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_lesson_finance_snapshots_payout_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_lesson_finance_snapshots_commission_status"');
    await queryRunner.query('DROP TABLE IF EXISTS "lesson_finance_snapshots"');
  }
}
