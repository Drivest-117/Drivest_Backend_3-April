import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonPickupContactNumber1770500000000 implements MigrationInterface {
  name = 'AddLessonPickupContactNumber1770500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "pickup_contact_number" text NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "lessons" DROP COLUMN IF EXISTS "pickup_contact_number"');
  }
}

