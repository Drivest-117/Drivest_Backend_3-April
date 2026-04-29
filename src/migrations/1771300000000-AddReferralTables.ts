import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralTables1771300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns to users table
    // Note: referredById and deviceIdHash columns are already in the entity, 
    // but might not be in the DB if we are following the migration history.
    // Based on the grep search, they were mentioned in master.md as part of A. Database Schema Updates.
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "referredById" uuid,
      ADD COLUMN IF NOT EXISTS "referralType" varchar,
      ADD COLUMN IF NOT EXISTS "deviceIdHash" varchar UNIQUE;
    `);

    // Create referral_events table
    await queryRunner.query(`
      CREATE TABLE "referral_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "referrer_id" uuid NOT NULL,
        "referralType" varchar NOT NULL,
        "state" varchar NOT NULL DEFAULT 'Captured',
        "metadata" jsonb,
        "fraudScore" int NOT NULL DEFAULT 0,
        "failureReason" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referral_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_referral_events_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_referral_events_referrer" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX "IDX_referral_events_user_id" ON "referral_events" ("user_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_referral_events_referrer_id" ON "referral_events" ("referrer_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_referral_events_state" ON "referral_events" ("state");`);

    // Create referral_payouts table
    await queryRunner.query(`
      CREATE TABLE "referral_payouts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "referrer_id" uuid NOT NULL,
        "referee_id" uuid NOT NULL,
        "amountPence" int NOT NULL,
        "bookingId" text,
        "expiryDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "isPaid" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referral_payouts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_referral_payouts_referrer" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_referral_payouts_referee" FOREIGN KEY ("referee_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX "IDX_referral_payouts_referrer_id" ON "referral_payouts" ("referrer_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_referral_payouts_referee_id" ON "referral_payouts" ("referee_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "referral_payouts";`);
    await queryRunner.query(`DROP TABLE "referral_events";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deviceIdHash";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "referralType";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "referredById";`);
  }
}
