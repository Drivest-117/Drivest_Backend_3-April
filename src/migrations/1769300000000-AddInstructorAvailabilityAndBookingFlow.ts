import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstructorAvailabilityAndBookingFlow1769300000000 implements MigrationInterface {
  name = 'AddInstructorAvailabilityAndBookingFlow1769300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "instructor_availability_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "instructor_id" uuid NOT NULL,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "status" text NOT NULL DEFAULT 'open',
        "booked_lesson_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "PK_instructor_availability_slots_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_instructor_availability_instructor" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id"),
        CONSTRAINT "FK_instructor_availability_booked_lesson" FOREIGN KEY ("booked_lesson_id") REFERENCES "lessons"("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_instructor_availability_instructor_starts" ON "instructor_availability_slots"("instructor_id", "starts_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_instructor_availability_status" ON "instructor_availability_slots"("status")',
    );

    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "availability_slot_id" uuid NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "learner_note" text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "lessons" ADD CONSTRAINT "FK_lessons_availability_slot" FOREIGN KEY ("availability_slot_id") REFERENCES "instructor_availability_slots"("id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_lessons_availability_slot_id" ON "lessons"("availability_slot_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_lessons_availability_slot_id"');
    await queryRunner.query('ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "FK_lessons_availability_slot"');
    await queryRunner.query('ALTER TABLE "lessons" DROP COLUMN IF EXISTS "learner_note"');
    await queryRunner.query('ALTER TABLE "lessons" DROP COLUMN IF EXISTS "availability_slot_id"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_instructor_availability_status"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_instructor_availability_instructor_starts"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "instructor_availability_slots"');
  }
}
