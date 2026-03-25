import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInstructorReviewModeration1771200000000 implements MigrationInterface {
  name = "AddInstructorReviewModeration1771200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" ADD COLUMN IF NOT EXISTS "reported_count" int NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" ADD COLUMN IF NOT EXISTS "last_reported_reason_code" text',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" ADD COLUMN IF NOT EXISTS "last_reported_note" text',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" ADD COLUMN IF NOT EXISTS "last_reported_at" timestamptz',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" ADD COLUMN IF NOT EXISTS "moderation_reason" text',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" ADD COLUMN IF NOT EXISTS "moderated_by_user_id" uuid',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" ADD COLUMN IF NOT EXISTS "moderated_at" timestamptz',
    );
    await queryRunner
      .query(
        'ALTER TABLE "instructor_reviews" ADD CONSTRAINT "FK_instructor_reviews_moderated_by_user" FOREIGN KEY ("moderated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL',
      )
      .catch(() => undefined);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_instructor_reviews_status" ON "instructor_reviews"("status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_instructor_reviews_reported_count" ON "instructor_reviews"("reported_count")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_instructor_reviews_reported_count"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_instructor_reviews_status"',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" DROP CONSTRAINT IF EXISTS "FK_instructor_reviews_moderated_by_user"',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" DROP COLUMN IF EXISTS "moderated_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" DROP COLUMN IF EXISTS "moderated_by_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" DROP COLUMN IF EXISTS "moderation_reason"',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" DROP COLUMN IF EXISTS "last_reported_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" DROP COLUMN IF EXISTS "last_reported_note"',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" DROP COLUMN IF EXISTS "last_reported_reason_code"',
    );
    await queryRunner.query(
      'ALTER TABLE "instructor_reviews" DROP COLUMN IF EXISTS "reported_count"',
    );
  }
}
