import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstructorPhaseOne1769100000000 implements MigrationInterface {
  name = 'AddInstructorPhaseOne1769100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" text,
        "name" text,
        "passwordHash" text,
        "role" text NOT NULL DEFAULT 'USER',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "instructors" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid UNIQUE NOT NULL,
        "full_name" text NOT NULL,
        "email" text NOT NULL,
        "phone" text,
        "adi_number" text NOT NULL,
        "profile_photo_url" text,
        "years_experience" int,
        "transmission_type" text NOT NULL,
        "hourly_rate_pence" int,
        "bio" text,
        "languages" text[],
        "coverage_postcodes" text[],
        "home_location" geography(Point, 4326),
        "is_approved" boolean NOT NULL DEFAULT false,
        "approved_at" timestamptz,
        "suspended_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_instructors_user" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query('CREATE UNIQUE INDEX "UQ_instructors_adi_number" ON "instructors"("adi_number")');
    await queryRunner.query('CREATE INDEX "IDX_instructors_is_approved" ON "instructors"("is_approved")');
    await queryRunner.query(
      'CREATE INDEX "IDX_instructors_coverage_postcodes" ON "instructors" USING GIN ("coverage_postcodes")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_instructors_home_location" ON "instructors" USING GIST ("home_location")',
    );

    await queryRunner.query(`
      CREATE TABLE "lessons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "instructor_id" uuid NOT NULL,
        "learner_user_id" uuid NOT NULL,
        "scheduled_at" timestamptz,
        "duration_minutes" int,
        "status" text NOT NULL DEFAULT 'planned',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_lessons_instructor" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id"),
        CONSTRAINT "FK_lessons_learner_user" FOREIGN KEY ("learner_user_id") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query('CREATE INDEX "IDX_lessons_instructor_id" ON "lessons"("instructor_id")');
    await queryRunner.query('CREATE INDEX "IDX_lessons_learner_user_id" ON "lessons"("learner_user_id")');

    await queryRunner.query(`
      CREATE TABLE "instructor_reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "instructor_id" uuid NOT NULL,
        "learner_user_id" uuid NOT NULL,
        "rating" int NOT NULL,
        "review_text" text,
        "lesson_id" uuid NOT NULL,
        "status" text NOT NULL DEFAULT 'visible',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_instructor_reviews_instructor" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id"),
        CONSTRAINT "FK_instructor_reviews_learner_user" FOREIGN KEY ("learner_user_id") REFERENCES "users"("id"),
        CONSTRAINT "FK_instructor_reviews_lesson" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id"),
        CONSTRAINT "CHK_instructor_reviews_rating" CHECK ("rating" >= 1 AND "rating" <= 5),
        CONSTRAINT "UQ_instructor_review_lesson" UNIQUE ("instructor_id", "learner_user_id", "lesson_id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "IDX_instructor_reviews_instructor_id" ON "instructor_reviews"("instructor_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_instructor_reviews_learner_user_id" ON "instructor_reviews"("learner_user_id")',
    );

    await queryRunner.query(`
      CREATE OR REPLACE VIEW "instructor_rating_summaries" AS
      SELECT
        r.instructor_id,
        COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::float AS rating_avg,
        COUNT(*)::int AS rating_count
      FROM instructor_reviews r
      WHERE r.deleted_at IS NULL
        AND r.status = 'visible'
      GROUP BY r.instructor_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP VIEW IF EXISTS "instructor_rating_summaries"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_instructor_reviews_learner_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_instructor_reviews_instructor_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "instructor_reviews"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_lessons_learner_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_lessons_instructor_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "lessons"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_instructors_home_location"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_instructors_coverage_postcodes"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_instructors_is_approved"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_instructors_adi_number"');
    await queryRunner.query('DROP TABLE IF EXISTS "instructors"');
  }
}
