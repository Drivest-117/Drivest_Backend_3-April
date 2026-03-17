import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLearningAnalytics1769900000000
  implements MigrationInterface
{
  name = 'AddUserLearningAnalytics1769900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_module_progress" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "module_key" character varying(64) NOT NULL,
        "language" character varying(16) NOT NULL DEFAULT 'und',
        "completion_percent" integer NOT NULL DEFAULT 0,
        "bookmarks" jsonb NULL,
        "wrong_queue" jsonb NULL,
        "metadata" jsonb NULL,
        "last_activity_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_module_progress_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_user_module_progress_user_module_language" UNIQUE ("user_id", "module_key", "language")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_module_pass_status" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "module_key" character varying(64) NOT NULL,
        "passed" boolean NOT NULL DEFAULT false,
        "passed_at" TIMESTAMPTZ NULL,
        "source" character varying(64) NOT NULL DEFAULT 'app',
        "metadata" jsonb NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_module_pass_status_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_user_module_pass_status_user_module" UNIQUE ("user_id", "module_key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_analytics_rollup" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "module_key" character varying(64) NOT NULL,
        "quizzes_completed" integer NOT NULL DEFAULT 0,
        "questions_answered" integer NOT NULL DEFAULT 0,
        "correct_answers" integer NOT NULL DEFAULT 0,
        "best_score_percent" integer NOT NULL DEFAULT 0,
        "last_score_percent" integer NOT NULL DEFAULT 0,
        "practice_started" integer NOT NULL DEFAULT 0,
        "practice_completed" integer NOT NULL DEFAULT 0,
        "navigation_started" integer NOT NULL DEFAULT 0,
        "navigation_completed" integer NOT NULL DEFAULT 0,
        "completed_route_ids" jsonb NULL,
        "metadata" jsonb NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_analytics_rollup_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_user_analytics_rollup_user_module" UNIQUE ("user_id", "module_key")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_user_module_progress_user_module" ON "user_module_progress" ("user_id", "module_key")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_user_module_pass_status_user_module" ON "user_module_pass_status" ("user_id", "module_key")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_user_analytics_rollup_user_module" ON "user_analytics_rollup" ("user_id", "module_key")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_user_analytics_rollup_user_module"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_user_module_pass_status_user_module"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_user_module_progress_user_module"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "user_analytics_rollup"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_module_pass_status"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_module_progress"');
  }
}
