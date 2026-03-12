import { MigrationInterface, QueryRunner } from 'typeorm';

type CouncilSeed = {
  id: string;
  name: string;
  sourceUrl?: string | null;
  centerLat: number;
  centerLon: number;
  coverageRadiusM?: number | null;
  defaultFeeState: 'free' | 'paid' | 'restricted' | 'unknown';
  defaultNote?: string | null;
};

type LocalitySeed = {
  id: string;
  councilId: string;
  label: string;
  centerLat: number;
  centerLon: number;
  radiusM: number;
  defaultFeeState: 'free' | 'paid' | 'restricted' | 'unknown';
  defaultNote?: string | null;
};

type TimeBandSeed = {
  id: string;
  scopeType: 'council' | 'locality';
  scopeId: string;
  dayMask: string;
  startTime: string;
  endTime: string;
  feeState: 'free' | 'paid' | 'restricted' | 'unknown';
  note?: string | null;
};

export class AddParkingAtlasV11769700000000 implements MigrationInterface {
  name = 'AddParkingAtlasV11769700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "parking_councils" (
        "id" text PRIMARY KEY,
        "name" character varying NOT NULL,
        "source_url" text,
        "center_lat" double precision NOT NULL,
        "center_lon" double precision NOT NULL,
        "coverage_radius_m" integer,
        "default_fee_state" character varying NOT NULL DEFAULT 'unknown',
        "default_note" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "parking_locality_overrides" (
        "id" text PRIMARY KEY,
        "council_id" text NOT NULL,
        "label" character varying NOT NULL,
        "center_lat" double precision NOT NULL,
        "center_lon" double precision NOT NULL,
        "radius_m" integer NOT NULL,
        "default_fee_state" character varying NOT NULL DEFAULT 'unknown',
        "default_note" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_parking_locality_council" FOREIGN KEY ("council_id") REFERENCES "parking_councils"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "parking_time_bands" (
        "id" text PRIMARY KEY,
        "scope_type" character varying NOT NULL,
        "scope_id" text NOT NULL,
        "day_mask" character varying NOT NULL,
        "start_time" character varying NOT NULL,
        "end_time" character varying NOT NULL,
        "fee_state" character varying NOT NULL,
        "note" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "parking_spots" (
        "id" text PRIMARY KEY,
        "council_id" text,
        "title" character varying NOT NULL,
        "lat" double precision NOT NULL,
        "lon" double precision NOT NULL,
        "geom" geography(Point,4326) NOT NULL,
        "spot_type" character varying,
        "source" character varying NOT NULL,
        "source_ref" character varying,
        "accessibility" boolean NOT NULL DEFAULT false,
        "base_fee_state" character varying NOT NULL DEFAULT 'unknown',
        "confidence_score" integer NOT NULL DEFAULT 50,
        "raw_tags" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_parking_spot_council" FOREIGN KEY ("council_id") REFERENCES "parking_councils"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "parking_source_snapshots" (
        "id" text PRIMARY KEY,
        "source" character varying NOT NULL,
        "scope" character varying NOT NULL,
        "version" character varying,
        "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" character varying NOT NULL,
        "metadata" jsonb
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_parking_spots_geom" ON "parking_spots" USING GIST ("geom")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_parking_spots_council" ON "parking_spots"("council_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_parking_locality_council" ON "parking_locality_overrides"("council_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_parking_time_bands_scope" ON "parking_time_bands"("scope_type", "scope_id")',
    );

    const councils: CouncilSeed[] = [
      {
        id: 'havering',
        name: 'London Borough of Havering',
        sourceUrl: 'https://www.havering.gov.uk/parking-2/paying-car-park-street-parking-spaces',
        centerLat: 51.5812,
        centerLon: 0.1837,
        coverageRadiusM: 12000,
        defaultFeeState: 'free',
        defaultNote: 'Outer-area roadside bays are often simpler and lower cost. Check local signage.',
      },
      { id: 'redbridge', name: 'London Borough of Redbridge', centerLat: 51.5761, centerLon: 0.083, coverageRadiusM: 11000, defaultFeeState: 'free', defaultNote: 'Residential roadside bays are often simpler outside the main centre. Check local signage.' },
      { id: 'barking-dagenham', name: 'London Borough of Barking and Dagenham', centerLat: 51.5541, centerLon: 0.134, coverageRadiusM: 10000, defaultFeeState: 'free', defaultNote: 'Residential roadside bays may be simpler outside the town centre. Check local signage.' },
      { id: 'newham', name: 'London Borough of Newham', centerLat: 51.528, centerLon: 0.036, coverageRadiusM: 10000, defaultFeeState: 'paid', defaultNote: 'Newham roadside bays are often paid or controlled in busy areas. Check local signage.' },
      { id: 'waltham-forest', name: 'London Borough of Waltham Forest', centerLat: 51.5908, centerLon: -0.0134, coverageRadiusM: 10000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be simpler outside the main centre. Check local signage.' },
      { id: 'croydon', name: 'London Borough of Croydon', centerLat: 51.3723, centerLon: -0.0982, coverageRadiusM: 14000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be simpler outside the main centre. Check local signage.' },
      { id: 'hillingdon', name: 'London Borough of Hillingdon', centerLat: 51.5441, centerLon: -0.476, coverageRadiusM: 15000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays are often simpler away from major centres. Check local signage.' },
      { id: 'ealing', name: 'London Borough of Ealing', centerLat: 51.514, centerLon: -0.304, coverageRadiusM: 12000, defaultFeeState: 'free', defaultNote: 'Residential roadside bays can be easier away from the high street. Check local signage.' },
      { id: 'westminster', name: 'City of Westminster', centerLat: 51.4975, centerLon: -0.1357, coverageRadiusM: 7000, defaultFeeState: 'paid', defaultNote: 'Westminster roadside bays are usually paid or heavily restricted. Check local signage.' },
      { id: 'camden', name: 'London Borough of Camden', centerLat: 51.539, centerLon: -0.1437, coverageRadiusM: 7000, defaultFeeState: 'paid', defaultNote: 'Camden roadside bays are usually paid or heavily restricted. Check local signage.' },
      { id: 'birmingham', name: 'Birmingham City Council', centerLat: 52.4862, centerLon: -1.8904, coverageRadiusM: 18000, defaultFeeState: 'free', defaultNote: 'Roadside parking outside the centre is often easier and lower stress. Check local signage.' },
      { id: 'manchester', name: 'Manchester City Council', centerLat: 53.4808, centerLon: -2.2426, coverageRadiusM: 15000, defaultFeeState: 'free', defaultNote: 'Roadside parking outside the centre is often easier than city-centre parking. Check local signage.' },
      { id: 'liverpool', name: 'Liverpool City Council', centerLat: 53.4084, centerLon: -2.9916, coverageRadiusM: 15000, defaultFeeState: 'free', defaultNote: 'Roadside parking outside the centre is often easier than central parking. Check local signage.' },
      { id: 'leeds', name: 'Leeds City Council', centerLat: 53.8008, centerLon: -1.5491, coverageRadiusM: 15000, defaultFeeState: 'free', defaultNote: 'Roadside parking outside the centre is often easier than central parking. Check local signage.' },
      { id: 'sheffield', name: 'Sheffield City Council', centerLat: 53.3811, centerLon: -1.4701, coverageRadiusM: 16000, defaultFeeState: 'free', defaultNote: 'Roadside parking outside the centre is often easier than central parking. Check local signage.' },
      { id: 'bristol', name: 'Bristol City Council', centerLat: 51.4545, centerLon: -2.5879, coverageRadiusM: 15000, defaultFeeState: 'free', defaultNote: 'Roadside parking outside the centre is often easier than central parking. Check local signage.' },
      { id: 'nottingham', name: 'Nottingham City Council', centerLat: 52.9548, centerLon: -1.1581, coverageRadiusM: 14000, defaultFeeState: 'free', defaultNote: 'Roadside parking outside the centre is often easier than central parking. Check local signage.' },
      { id: 'leicester', name: 'Leicester City Council', centerLat: 52.6369, centerLon: -1.1398, coverageRadiusM: 14000, defaultFeeState: 'free', defaultNote: 'Roadside parking outside the centre is often easier than central parking. Check local signage.' },
      { id: 'coventry', name: 'Coventry City Council', centerLat: 52.4068, centerLon: -1.5197, coverageRadiusM: 14000, defaultFeeState: 'free', defaultNote: 'Roadside parking outside the centre is often easier than central parking. Check local signage.' },
      { id: 'oxford', name: 'Oxford City Council', centerLat: 51.752, centerLon: -1.2577, coverageRadiusM: 12000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be easier than central parking. Check local signage.' },
      { id: 'cambridge', name: 'Cambridge City Council', centerLat: 52.2053, centerLon: 0.1218, coverageRadiusM: 12000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be easier than central parking. Check local signage.' },
      { id: 'reading', name: 'Reading Borough Council', centerLat: 51.4543, centerLon: -0.9781, coverageRadiusM: 12000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be easier than town-centre parking. Check local signage.' },
      { id: 'southampton', name: 'Southampton City Council', centerLat: 50.9097, centerLon: -1.4044, coverageRadiusM: 13000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be easier than city-centre parking. Check local signage.' },
      { id: 'portsmouth', name: 'Portsmouth City Council', centerLat: 50.8198, centerLon: -1.088, coverageRadiusM: 12000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be easier than city-centre parking. Check local signage.' },
      { id: 'brighton-hove', name: 'Brighton & Hove City Council', centerLat: 50.8225, centerLon: -0.1372, coverageRadiusM: 14000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be easier than seafront and city-centre parking. Check local signage.' },
      { id: 'york', name: 'City of York Council', centerLat: 53.959, centerLon: -1.0815, coverageRadiusM: 12000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be easier than central parking. Check local signage.' },
      { id: 'milton-keynes', name: 'Milton Keynes City Council', centerLat: 52.0406, centerLon: -0.7594, coverageRadiusM: 17000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be easier than central parking. Check local signage.' },
      { id: 'norwich', name: 'Norwich City Council', centerLat: 52.6309, centerLon: 1.2974, coverageRadiusM: 12000, defaultFeeState: 'free', defaultNote: 'Outer roadside bays may be easier than central parking. Check local signage.' },
    ];

    const localities: LocalitySeed[] = [
      { id: 'havering:romford', councilId: 'havering', label: 'Romford', centerLat: 51.5761, centerLon: 0.1837, radiusM: 2200, defaultFeeState: 'free', defaultNote: 'Romford centre roadside bays vary by time. Check local signage.' },
      { id: 'redbridge:ilford', councilId: 'redbridge', label: 'Ilford', centerLat: 51.559, centerLon: 0.0741, radiusM: 1800, defaultFeeState: 'free', defaultNote: 'Ilford centre roadside bays vary by time. Check local signage.' },
      { id: 'barking-dagenham:barking', councilId: 'barking-dagenham', label: 'Barking', centerLat: 51.5396, centerLon: 0.0817, radiusM: 1700, defaultFeeState: 'free', defaultNote: 'Barking centre roadside bays vary by time. Check local signage.' },
      { id: 'newham:stratford', councilId: 'newham', label: 'Stratford', centerLat: 51.5413, centerLon: -0.0032, radiusM: 2200, defaultFeeState: 'paid', defaultNote: 'Stratford roadside bays are usually paid or restricted. Check local signage.' },
      { id: 'waltham-forest:walthamstow', councilId: 'waltham-forest', label: 'Walthamstow', centerLat: 51.5842, centerLon: -0.0198, radiusM: 1600, defaultFeeState: 'free', defaultNote: 'Walthamstow centre roadside bays vary by time. Check local signage.' },
      { id: 'croydon:croydon-centre', councilId: 'croydon', label: 'Croydon Town Centre', centerLat: 51.3727, centerLon: -0.1099, radiusM: 2200, defaultFeeState: 'free', defaultNote: 'Croydon centre roadside bays vary by time. Check local signage.' },
      { id: 'hillingdon:uxbridge', councilId: 'hillingdon', label: 'Uxbridge', centerLat: 51.5465, centerLon: -0.4786, radiusM: 1600, defaultFeeState: 'free', defaultNote: 'Uxbridge centre roadside bays vary by time. Check local signage.' },
      { id: 'ealing:ealing-broadway', councilId: 'ealing', label: 'Ealing Broadway', centerLat: 51.5142, centerLon: -0.3017, radiusM: 1600, defaultFeeState: 'free', defaultNote: 'Ealing Broadway roadside bays vary by time. Check local signage.' },
      { id: 'birmingham:city-centre', councilId: 'birmingham', label: 'Birmingham City Centre', centerLat: 52.4797, centerLon: -1.9027, radiusM: 2800, defaultFeeState: 'free', defaultNote: 'Birmingham city-centre roadside bays vary by time. Check local signage.' },
      { id: 'manchester:city-centre', councilId: 'manchester', label: 'Manchester City Centre', centerLat: 53.4808, centerLon: -2.2426, radiusM: 2600, defaultFeeState: 'free', defaultNote: 'Manchester city-centre roadside bays vary by time. Check local signage.' },
      { id: 'liverpool:city-centre', councilId: 'liverpool', label: 'Liverpool City Centre', centerLat: 53.4072, centerLon: -2.9917, radiusM: 2400, defaultFeeState: 'free', defaultNote: 'Liverpool city-centre roadside bays vary by time. Check local signage.' },
      { id: 'leeds:city-centre', councilId: 'leeds', label: 'Leeds City Centre', centerLat: 53.7974, centerLon: -1.5438, radiusM: 2500, defaultFeeState: 'free', defaultNote: 'Leeds city-centre roadside bays vary by time. Check local signage.' },
      { id: 'sheffield:city-centre', councilId: 'sheffield', label: 'Sheffield City Centre', centerLat: 53.3811, centerLon: -1.4701, radiusM: 2200, defaultFeeState: 'free', defaultNote: 'Sheffield city-centre roadside bays vary by time. Check local signage.' },
      { id: 'bristol:city-centre', councilId: 'bristol', label: 'Bristol City Centre', centerLat: 51.4545, centerLon: -2.5879, radiusM: 2500, defaultFeeState: 'free', defaultNote: 'Bristol city-centre roadside bays vary by time. Check local signage.' },
      { id: 'nottingham:city-centre', councilId: 'nottingham', label: 'Nottingham City Centre', centerLat: 52.9548, centerLon: -1.1581, radiusM: 2200, defaultFeeState: 'free', defaultNote: 'Nottingham city-centre roadside bays vary by time. Check local signage.' },
      { id: 'leicester:city-centre', councilId: 'leicester', label: 'Leicester City Centre', centerLat: 52.6369, centerLon: -1.1398, radiusM: 2200, defaultFeeState: 'free', defaultNote: 'Leicester city-centre roadside bays vary by time. Check local signage.' },
      { id: 'coventry:city-centre', councilId: 'coventry', label: 'Coventry City Centre', centerLat: 52.4068, centerLon: -1.5197, radiusM: 2200, defaultFeeState: 'free', defaultNote: 'Coventry city-centre roadside bays vary by time. Check local signage.' },
      { id: 'oxford:city-centre', councilId: 'oxford', label: 'Oxford City Centre', centerLat: 51.752, centerLon: -1.2577, radiusM: 1800, defaultFeeState: 'free', defaultNote: 'Oxford city-centre roadside bays vary by time. Check local signage.' },
      { id: 'cambridge:city-centre', councilId: 'cambridge', label: 'Cambridge City Centre', centerLat: 52.2053, centerLon: 0.1218, radiusM: 1800, defaultFeeState: 'free', defaultNote: 'Cambridge city-centre roadside bays vary by time. Check local signage.' },
      { id: 'reading:town-centre', councilId: 'reading', label: 'Reading Town Centre', centerLat: 51.4543, centerLon: -0.9781, radiusM: 1700, defaultFeeState: 'free', defaultNote: 'Reading town-centre roadside bays vary by time. Check local signage.' },
      { id: 'southampton:city-centre', councilId: 'southampton', label: 'Southampton City Centre', centerLat: 50.9097, centerLon: -1.4044, radiusM: 1800, defaultFeeState: 'free', defaultNote: 'Southampton city-centre roadside bays vary by time. Check local signage.' },
      { id: 'portsmouth:city-centre', councilId: 'portsmouth', label: 'Portsmouth City Centre', centerLat: 50.8198, centerLon: -1.088, radiusM: 1800, defaultFeeState: 'free', defaultNote: 'Portsmouth city-centre roadside bays vary by time. Check local signage.' },
      { id: 'brighton-hove:brighton-centre', councilId: 'brighton-hove', label: 'Brighton Centre', centerLat: 50.8225, centerLon: -0.1372, radiusM: 2200, defaultFeeState: 'free', defaultNote: 'Brighton centre roadside bays vary by time. Check local signage.' },
      { id: 'york:city-centre', councilId: 'york', label: 'York City Centre', centerLat: 53.959, centerLon: -1.0815, radiusM: 1800, defaultFeeState: 'free', defaultNote: 'York city-centre roadside bays vary by time. Check local signage.' },
      { id: 'milton-keynes:central', councilId: 'milton-keynes', label: 'Central Milton Keynes', centerLat: 52.0406, centerLon: -0.7594, radiusM: 2400, defaultFeeState: 'free', defaultNote: 'Central Milton Keynes roadside bays vary by time. Check local signage.' },
      { id: 'norwich:city-centre', councilId: 'norwich', label: 'Norwich City Centre', centerLat: 52.6309, centerLon: 1.2974, radiusM: 1700, defaultFeeState: 'free', defaultNote: 'Norwich city-centre roadside bays vary by time. Check local signage.' },
    ];

    const timeBands: TimeBandSeed[] = [
      { id: 'havering:romford:day', scopeType: 'locality', scopeId: 'havering:romford', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Romford centre roadside bays are usually paid during the day.' },
      { id: 'redbridge:ilford:day', scopeType: 'locality', scopeId: 'redbridge:ilford', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Ilford centre roadside bays are usually paid during the day.' },
      { id: 'barking-dagenham:barking:day', scopeType: 'locality', scopeId: 'barking-dagenham:barking', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Barking centre roadside bays are usually paid during the day.' },
      { id: 'waltham-forest:walthamstow:day', scopeType: 'locality', scopeId: 'waltham-forest:walthamstow', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Walthamstow centre roadside bays are usually paid during the day.' },
      { id: 'croydon:croydon-centre:day', scopeType: 'locality', scopeId: 'croydon:croydon-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Croydon centre roadside bays are usually paid during the day.' },
      { id: 'hillingdon:uxbridge:day', scopeType: 'locality', scopeId: 'hillingdon:uxbridge', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Uxbridge centre roadside bays are usually paid during the day.' },
      { id: 'ealing:ealing-broadway:day', scopeType: 'locality', scopeId: 'ealing:ealing-broadway', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Ealing Broadway roadside bays are usually paid during the day.' },
      { id: 'birmingham:city-centre:day', scopeType: 'locality', scopeId: 'birmingham:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Birmingham city-centre roadside bays are usually paid during the day.' },
      { id: 'manchester:city-centre:day', scopeType: 'locality', scopeId: 'manchester:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Manchester city-centre roadside bays are usually paid during the day.' },
      { id: 'liverpool:city-centre:day', scopeType: 'locality', scopeId: 'liverpool:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Liverpool city-centre roadside bays are usually paid during the day.' },
      { id: 'leeds:city-centre:day', scopeType: 'locality', scopeId: 'leeds:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Leeds city-centre roadside bays are usually paid during the day.' },
      { id: 'sheffield:city-centre:day', scopeType: 'locality', scopeId: 'sheffield:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Sheffield city-centre roadside bays are usually paid during the day.' },
      { id: 'bristol:city-centre:day', scopeType: 'locality', scopeId: 'bristol:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Bristol city-centre roadside bays are usually paid during the day.' },
      { id: 'nottingham:city-centre:day', scopeType: 'locality', scopeId: 'nottingham:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Nottingham city-centre roadside bays are usually paid during the day.' },
      { id: 'leicester:city-centre:day', scopeType: 'locality', scopeId: 'leicester:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Leicester city-centre roadside bays are usually paid during the day.' },
      { id: 'coventry:city-centre:day', scopeType: 'locality', scopeId: 'coventry:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Coventry city-centre roadside bays are usually paid during the day.' },
      { id: 'oxford:city-centre:day', scopeType: 'locality', scopeId: 'oxford:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Oxford city-centre roadside bays are usually paid during the day.' },
      { id: 'cambridge:city-centre:day', scopeType: 'locality', scopeId: 'cambridge:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Cambridge city-centre roadside bays are usually paid during the day.' },
      { id: 'reading:town-centre:day', scopeType: 'locality', scopeId: 'reading:town-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Reading town-centre roadside bays are usually paid during the day.' },
      { id: 'southampton:city-centre:day', scopeType: 'locality', scopeId: 'southampton:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Southampton city-centre roadside bays are usually paid during the day.' },
      { id: 'portsmouth:city-centre:day', scopeType: 'locality', scopeId: 'portsmouth:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Portsmouth city-centre roadside bays are usually paid during the day.' },
      { id: 'brighton-hove:brighton-centre:day', scopeType: 'locality', scopeId: 'brighton-hove:brighton-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Brighton centre roadside bays are usually paid during the day.' },
      { id: 'york:city-centre:day', scopeType: 'locality', scopeId: 'york:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'York city-centre roadside bays are usually paid during the day.' },
      { id: 'milton-keynes:central:day', scopeType: 'locality', scopeId: 'milton-keynes:central', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Central Milton Keynes roadside bays are usually paid during the day.' },
      { id: 'norwich:city-centre:day', scopeType: 'locality', scopeId: 'norwich:city-centre', dayMask: 'weekdays,sat', startTime: '08:00', endTime: '18:30', feeState: 'paid', note: 'Norwich city-centre roadside bays are usually paid during the day.' },
    ];

    for (const council of councils) {
      await queryRunner.query(
        `
          INSERT INTO "parking_councils" (
            "id",
            "name",
            "source_url",
            "center_lat",
            "center_lon",
            "coverage_radius_m",
            "default_fee_state",
            "default_note"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT ("id") DO UPDATE SET
            "name" = EXCLUDED."name",
            "source_url" = EXCLUDED."source_url",
            "center_lat" = EXCLUDED."center_lat",
            "center_lon" = EXCLUDED."center_lon",
            "coverage_radius_m" = EXCLUDED."coverage_radius_m",
            "default_fee_state" = EXCLUDED."default_fee_state",
            "default_note" = EXCLUDED."default_note",
            "updated_at" = now()
        `,
        [
          council.id,
          council.name,
          council.sourceUrl ?? null,
          council.centerLat,
          council.centerLon,
          council.coverageRadiusM ?? null,
          council.defaultFeeState,
          council.defaultNote ?? null,
        ],
      );
    }

    for (const locality of localities) {
      await queryRunner.query(
        `
          INSERT INTO "parking_locality_overrides" (
            "id",
            "council_id",
            "label",
            "center_lat",
            "center_lon",
            "radius_m",
            "default_fee_state",
            "default_note"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT ("id") DO UPDATE SET
            "council_id" = EXCLUDED."council_id",
            "label" = EXCLUDED."label",
            "center_lat" = EXCLUDED."center_lat",
            "center_lon" = EXCLUDED."center_lon",
            "radius_m" = EXCLUDED."radius_m",
            "default_fee_state" = EXCLUDED."default_fee_state",
            "default_note" = EXCLUDED."default_note",
            "updated_at" = now()
        `,
        [
          locality.id,
          locality.councilId,
          locality.label,
          locality.centerLat,
          locality.centerLon,
          locality.radiusM,
          locality.defaultFeeState,
          locality.defaultNote ?? null,
        ],
      );
    }

    for (const timeBand of timeBands) {
      await queryRunner.query(
        `
          INSERT INTO "parking_time_bands" (
            "id",
            "scope_type",
            "scope_id",
            "day_mask",
            "start_time",
            "end_time",
            "fee_state",
            "note"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT ("id") DO UPDATE SET
            "scope_type" = EXCLUDED."scope_type",
            "scope_id" = EXCLUDED."scope_id",
            "day_mask" = EXCLUDED."day_mask",
            "start_time" = EXCLUDED."start_time",
            "end_time" = EXCLUDED."end_time",
            "fee_state" = EXCLUDED."fee_state",
            "note" = EXCLUDED."note",
            "updated_at" = now()
        `,
        [
          timeBand.id,
          timeBand.scopeType,
          timeBand.scopeId,
          timeBand.dayMask,
          timeBand.startTime,
          timeBand.endTime,
          timeBand.feeState,
          timeBand.note ?? null,
        ],
      );
    }

    await queryRunner.query(
      `
        INSERT INTO "parking_source_snapshots" (
          "id",
          "source",
          "scope",
          "version",
          "fetched_at",
          "status",
          "metadata"
        )
        VALUES ($1, $2, $3, $4, now(), $5, $6)
        ON CONFLICT ("id") DO UPDATE SET
          "version" = EXCLUDED."version",
          "fetched_at" = EXCLUDED."fetched_at",
          "status" = EXCLUDED."status",
          "metadata" = EXCLUDED."metadata"
      `,
      [
        'parking-atlas-v1',
        'drivest-seed',
        'england-major-authorities',
        '1',
        'READY',
        JSON.stringify({
          councils: councils.length,
          localities: localities.length,
          timeBands: timeBands.length,
        }),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "parking_source_snapshots"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_parking_spots_geom"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_parking_spots_council"');
    await queryRunner.query('DROP TABLE IF EXISTS "parking_spots"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_parking_time_bands_scope"');
    await queryRunner.query('DROP TABLE IF EXISTS "parking_time_bands"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_parking_locality_council"');
    await queryRunner.query('DROP TABLE IF EXISTS "parking_locality_overrides"');
    await queryRunner.query('DROP TABLE IF EXISTS "parking_councils"');
  }
}
