import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteExternalRouteId1770100000000 implements MigrationInterface {
  name = 'AddRouteExternalRouteId1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "externalRouteId" character varying`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_routes_centre_external_route_id" ON "routes" ("centreId", "externalRouteId") WHERE "externalRouteId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_routes_centre_external_route_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "routes" DROP COLUMN IF EXISTS "externalRouteId"`,
    );
  }
}
