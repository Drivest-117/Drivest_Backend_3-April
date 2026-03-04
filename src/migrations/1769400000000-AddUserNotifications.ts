import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNotifications1769400000000 implements MigrationInterface {
  name = 'AddUserNotifications1769400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "actor_user_id" uuid NULL,
        "category" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "payload" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "read_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "PK_user_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_user_notifications_user_created" ON "user_notifications"("user_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_notifications_user_read" ON "user_notifications"("user_id", "read_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_notifications_user_read"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_notifications_user_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_notifications"');
  }
}
