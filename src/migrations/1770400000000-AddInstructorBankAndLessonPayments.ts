import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstructorBankAndLessonPayments1770400000000 implements MigrationInterface {
  name = 'AddInstructorBankAndLessonPayments1770400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "instructors" ADD COLUMN IF NOT EXISTS "bank_account_holder_name" text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "instructors" ADD COLUMN IF NOT EXISTS "bank_sort_code" text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "instructors" ADD COLUMN IF NOT EXISTS "bank_account_number" text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "instructors" ADD COLUMN IF NOT EXISTS "bank_name" text NULL',
    );

    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "pickup_address" text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "pickup_postcode" text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "pickup_lat" double precision NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "pickup_lng" double precision NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "pickup_place_id" text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "pickup_note" text NULL',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lesson_id" uuid NOT NULL,
        "provider" text NOT NULL DEFAULT 'stripe',
        "status" text NOT NULL DEFAULT 'pending',
        "currency_code" text NOT NULL DEFAULT 'GBP',
        "amount_pence" int NULL,
        "checkout_session_id" text NULL,
        "checkout_url" text NULL,
        "payment_intent_id" text NULL,
        "product_id" text NULL,
        "transaction_id" text NULL,
        "captured_at" timestamptz NULL,
        "failure_reason" text NULL,
        "raw_provider_payload" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lesson_payments_lesson_id" UNIQUE ("lesson_id"),
        CONSTRAINT "UQ_lesson_payments_transaction_id" UNIQUE ("transaction_id"),
        CONSTRAINT "FK_lesson_payments_lesson" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_lesson_payments_status" ON "lesson_payments"("status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_lesson_payments_provider" ON "lesson_payments"("provider")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_lesson_payments_checkout_session_id" ON "lesson_payments"("checkout_session_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_lesson_payments_checkout_session_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_lesson_payments_provider"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_lesson_payments_status"');
    await queryRunner.query('DROP TABLE IF EXISTS "lesson_payments"');

    await queryRunner.query('ALTER TABLE "lessons" DROP COLUMN IF EXISTS "pickup_note"');
    await queryRunner.query('ALTER TABLE "lessons" DROP COLUMN IF EXISTS "pickup_place_id"');
    await queryRunner.query('ALTER TABLE "lessons" DROP COLUMN IF EXISTS "pickup_lng"');
    await queryRunner.query('ALTER TABLE "lessons" DROP COLUMN IF EXISTS "pickup_lat"');
    await queryRunner.query('ALTER TABLE "lessons" DROP COLUMN IF EXISTS "pickup_postcode"');
    await queryRunner.query('ALTER TABLE "lessons" DROP COLUMN IF EXISTS "pickup_address"');

    await queryRunner.query('ALTER TABLE "instructors" DROP COLUMN IF EXISTS "bank_name"');
    await queryRunner.query(
      'ALTER TABLE "instructors" DROP COLUMN IF EXISTS "bank_account_number"',
    );
    await queryRunner.query('ALTER TABLE "instructors" DROP COLUMN IF EXISTS "bank_sort_code"');
    await queryRunner.query(
      'ALTER TABLE "instructors" DROP COLUMN IF EXISTS "bank_account_holder_name"',
    );
  }
}
