import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHstoreExtension1769050000000 implements MigrationInterface {
  name = 'AddHstoreExtension1769050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS hstore');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep extension in place because other objects may depend on it.
  }
}
