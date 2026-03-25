import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstructorLinking1771000000000 implements MigrationInterface {
  name = 'AddInstructorLinking1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "instructor_share_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "instructor_id" uuid NOT NULL,
        "code" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "expires_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_instructor_share_codes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_instructor_share_codes_instructor" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_instructor_share_codes_instructor_active" ON "instructor_share_codes"("instructor_id", "is_active")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_instructor_share_codes_code_active" ON "instructor_share_codes"("code", "is_active")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "instructor_learner_links" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "instructor_id" uuid NOT NULL,
        "learner_user_id" uuid NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "request_code" text NULL,
        "requested_at" timestamptz NOT NULL DEFAULT now(),
        "approved_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_instructor_learner_links_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_instructor_learner_links_instructor" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_instructor_learner_links_learner" FOREIGN KEY ("learner_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_instructor_learner_links_pair" UNIQUE ("instructor_id", "learner_user_id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_instructor_learner_links_instructor_status" ON "instructor_learner_links"("instructor_id", "status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_instructor_learner_links_learner_status" ON "instructor_learner_links"("learner_user_id", "status")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_instructor_learner_links_learner_status"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_instructor_learner_links_instructor_status"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "instructor_learner_links"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_instructor_share_codes_code_active"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_instructor_share_codes_instructor_active"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "instructor_share_codes"');
  }
}
