import { MigrationInterface, QueryRunner } from 'typeorm';

export class DisableColchesterDevRoute1770600000000 implements MigrationInterface {
  name = 'DisableColchesterDevRoute1770600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "routes"
        SET "isActive" = false
        WHERE LOWER(TRIM("name")) = 'colchester dev route'
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "routes"
        SET "isActive" = true
        WHERE LOWER(TRIM("name")) = 'colchester dev route'
      `,
    );
  }
}

