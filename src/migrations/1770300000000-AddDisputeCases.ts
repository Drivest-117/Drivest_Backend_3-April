import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputeCases1770300000000 implements MigrationInterface {
  name = 'AddDisputeCases1770300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dispute_cases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lesson_id" uuid NULL,
        "opened_by_user_id" uuid NOT NULL,
        "opened_by_role" text NOT NULL,
        "against_user_id" uuid NULL,
        "against_role" text NULL,
        "category" text NOT NULL DEFAULT 'booking',
        "title" text NOT NULL,
        "description" text NOT NULL,
        "status" text NOT NULL DEFAULT 'opened',
        "priority" text NOT NULL DEFAULT 'normal',
        "first_response_by" timestamptz NOT NULL,
        "resolution_target_by" timestamptz NOT NULL,
        "responded_at" timestamptz NULL,
        "resolved_at" timestamptz NULL,
        "closed_at" timestamptz NULL,
        "last_actor_user_id" uuid NULL,
        "latest_note" text NULL,
        "evidence" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "PK_dispute_cases_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dispute_cases_lesson" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id"),
        CONSTRAINT "FK_dispute_cases_opened_by_user" FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id"),
        CONSTRAINT "FK_dispute_cases_against_user" FOREIGN KEY ("against_user_id") REFERENCES "users"("id"),
        CONSTRAINT "FK_dispute_cases_last_actor_user" FOREIGN KEY ("last_actor_user_id") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "IDX_dispute_cases_status" ON "dispute_cases"("status")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_dispute_cases_opened_by" ON "dispute_cases"("opened_by_user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_dispute_cases_against_user" ON "dispute_cases"("against_user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_dispute_cases_first_response_by" ON "dispute_cases"("first_response_by")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_dispute_cases_resolution_target_by" ON "dispute_cases"("resolution_target_by")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_dispute_cases_resolution_target_by"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_dispute_cases_first_response_by"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_dispute_cases_against_user"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_dispute_cases_opened_by"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_dispute_cases_status"');
    await queryRunner.query('DROP TABLE IF EXISTS "dispute_cases"');
  }
}
