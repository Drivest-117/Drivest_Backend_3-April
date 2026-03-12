import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { DataSource } from 'typeorm';
import { ParkingSearchDto } from './dto/parking-search.dto';
import { ParkingImportCouncilDto } from './dto/parking-import-council.dto';

type FeeState = 'free' | 'paid' | 'restricted' | 'unknown';
type ScopeType = 'council' | 'locality';

interface ParkingCouncilRow {
  id: string;
  name: string;
  sourceUrl: string | null;
  centerLat: number;
  centerLon: number;
  coverageRadiusM: number | null;
  defaultFeeState: FeeState;
  defaultNote: string | null;
  distanceM?: number;
}

interface ParkingSpotRow {
  id: string;
  councilId: string | null;
  title: string;
  lat: number;
  lon: number;
  spotType: string | null;
  source: string;
  sourceRef: string | null;
  baseFeeState: FeeState;
  accessible: boolean;
  confidence: number;
  rawTags: Record<string, unknown> | null;
  updatedAt: Date;
  distanceM: number;
}

interface ParkingLocalityRow {
  id: string;
  councilId: string;
  label: string;
  centerLat: number;
  centerLon: number;
  radiusM: number;
  defaultFeeState: FeeState;
  defaultNote: string | null;
}

interface ParkingTimeBandRow {
  id: string;
  scopeType: ScopeType;
  scopeId: string;
  dayMask: string;
  startTime: string;
  endTime: string;
  feeState: FeeState;
  note: string | null;
}

interface TimeContext {
  iso: string;
  dayCode: string;
  minuteOfDay: number;
}

interface OverpassElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
}

interface IngestSeedArea {
  id: string;
  label: string;
  lat: number;
  lon: number;
  radiusM: number;
}

interface AtlasCouncilRecord {
  id: string;
  name: string;
  lat: number;
  lon: number;
  coverageRadiusMeters?: number | null;
}

interface AtlasTimeBandRecord {
  days?: string[];
  start: string;
  end: string;
  roadsideFee?: string | null;
  roadsideNote?: string | null;
}

interface AtlasLocalityRecord {
  label: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  roadsideFee?: string | null;
  roadsideNote?: string | null;
  timeBands?: AtlasTimeBandRecord[];
}

interface AtlasRuleRecord {
  councilId: string;
  sourceURL?: string | null;
  defaultRoadsideFee?: string | null;
  defaultRoadsideNote?: string | null;
  timeBands?: AtlasTimeBandRecord[];
  localityOverrides?: AtlasLocalityRecord[];
}

interface FlatAtlasRuleRow {
  label: string;
  lat: number | string;
  lon: number | string;
  radiusMeters?: number | string;
  roadsideFee?: string | null;
  roadsideNote?: string | null;
  days?: string[] | string;
  start?: string | null;
  end?: string | null;
}

@Injectable()
export class ParkingService {
  private readonly overpassEndpoint = 'https://overpass-api.de/api/interpreter';

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listCouncils() {
    const councils = await this.dataSource.query(
      `
        SELECT
          id,
          name,
          source_url AS "sourceUrl",
          center_lat AS "centerLat",
          center_lon AS "centerLon",
          coverage_radius_m AS "coverageRadiusM",
          default_fee_state AS "defaultFeeState",
          default_note AS "defaultNote"
        FROM parking_councils
        ORDER BY name ASC
      `,
    );

    return {
      items: councils,
      meta: {
        total: councils.length,
      },
    };
  }

  async search(dto: ParkingSearchDto) {
    const bounds = this.resolveBounds(dto);
    const center = this.resolveCenter(dto, bounds);
    const limit = dto.limit ?? 60;
    const feeFilter = dto.fee ?? 'all';
    const accessibleOnly = dto.accessible ?? false;
    const timeContext = this.resolveTimeContext(dto.at);

    const areaCouncil = await this.resolveAreaCouncil(center.lat, center.lon);
    const spots = (await this.dataSource.query(
      `
        SELECT
          s.id,
          s.council_id AS "councilId",
          s.title,
          s.lat,
          s.lon,
          s.spot_type AS "spotType",
          s.source,
          s.source_ref AS "sourceRef",
          s.base_fee_state AS "baseFeeState",
          s.accessibility AS "accessible",
          s.confidence_score AS "confidence",
          s.raw_tags AS "rawTags",
          s.updated_at AS "updatedAt",
          ST_Distance(
            s.geom,
            ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography
          ) AS "distanceM"
        FROM parking_spots s
        WHERE ST_Intersects(
          s.geom::geometry,
          ST_MakeEnvelope($1, $2, $3, $4, 4326)
        )
          AND ($7::boolean = false OR s.accessibility = true)
        ORDER BY "distanceM" ASC, s.confidence_score DESC
        LIMIT $8
      `,
      [
        bounds.minLon,
        bounds.minLat,
        bounds.maxLon,
        bounds.maxLat,
        center.lon,
        center.lat,
        accessibleOnly,
        limit,
      ],
    )) as ParkingSpotRow[];

    const councilIds = Array.from(
      new Set(spots.map((spot) => spot.councilId).filter(Boolean)),
    ) as string[];

    const councils = councilIds.length
      ? ((await this.dataSource.query(
          `
            SELECT
              id,
              name,
              source_url AS "sourceUrl",
              center_lat AS "centerLat",
              center_lon AS "centerLon",
              coverage_radius_m AS "coverageRadiusM",
              default_fee_state AS "defaultFeeState",
              default_note AS "defaultNote"
            FROM parking_councils
            WHERE id = ANY($1)
          `,
          [councilIds],
        )) as ParkingCouncilRow[])
      : [];

    const localities = councilIds.length
      ? ((await this.dataSource.query(
          `
            SELECT
              id,
              council_id AS "councilId",
              label,
              center_lat AS "centerLat",
              center_lon AS "centerLon",
              radius_m AS "radiusM",
              default_fee_state AS "defaultFeeState",
              default_note AS "defaultNote"
            FROM parking_locality_overrides
            WHERE council_id = ANY($1)
          `,
          [councilIds],
        )) as ParkingLocalityRow[])
      : [];

    const localityIds = localities.map((locality) => locality.id);
    const timeBands =
      councilIds.length || localityIds.length
        ? ((await this.dataSource.query(
            `
              SELECT
                id,
                scope_type AS "scopeType",
                scope_id AS "scopeId",
                day_mask AS "dayMask",
                start_time AS "startTime",
                end_time AS "endTime",
                fee_state AS "feeState",
                note
              FROM parking_time_bands
              WHERE
                (scope_type = 'council' AND scope_id = ANY($1))
                OR
                (scope_type = 'locality' AND scope_id = ANY($2))
            `,
            [councilIds, localityIds],
          )) as ParkingTimeBandRow[])
        : [];

    const councilMap = new Map(councils.map((council) => [council.id, council]));
    const localitiesByCouncil = localities.reduce<Record<string, ParkingLocalityRow[]>>(
      (acc, locality) => {
        (acc[locality.councilId] ||= []).push(locality);
        return acc;
      },
      {},
    );
    const timeBandsByScope = timeBands.reduce<Record<string, ParkingTimeBandRow[]>>(
      (acc, timeBand) => {
        (acc[`${timeBand.scopeType}:${timeBand.scopeId}`] ||= []).push(timeBand);
        return acc;
      },
      {},
    );

    const evaluated = spots.map((spot) =>
      this.toSearchItem(
        spot,
        councilMap.get(spot.councilId ?? '') ?? areaCouncil ?? null,
        localitiesByCouncil[spot.councilId ?? ''] ?? [],
        timeBandsByScope,
        timeContext,
      ),
    );

    const summary = evaluated.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.statusNow] += 1;
        return acc;
      },
      {
        total: 0,
        free: 0,
        paid: 0,
        restricted: 0,
        unknown: 0,
      },
    );

    const items =
      feeFilter === 'all'
        ? evaluated
        : evaluated.filter((item) => item.statusNow === feeFilter);

    return {
      area: {
        minLat: bounds.minLat,
        minLon: bounds.minLon,
        maxLat: bounds.maxLat,
        maxLon: bounds.maxLon,
        centerLat: center.lat,
        centerLon: center.lon,
        at: timeContext.iso,
      },
      council: areaCouncil
        ? {
            id: areaCouncil.id,
            name: areaCouncil.name,
            sourceUrl: areaCouncil.sourceUrl,
          }
        : null,
      summary,
      items,
    };
  }

  async findSpot(id: string, at?: string) {
    const spot = (await this.dataSource.query(
      `
        SELECT
          s.id,
          s.council_id AS "councilId",
          s.title,
          s.lat,
          s.lon,
          s.spot_type AS "spotType",
          s.source,
          s.source_ref AS "sourceRef",
          s.base_fee_state AS "baseFeeState",
          s.accessibility AS "accessible",
          s.confidence_score AS "confidence",
          s.raw_tags AS "rawTags",
          s.updated_at AS "updatedAt",
          0::double precision AS "distanceM"
        FROM parking_spots s
        WHERE s.id = $1
        LIMIT 1
      `,
      [id],
    )) as ParkingSpotRow[];

    if (!spot[0]) {
      throw new NotFoundException('Parking spot not found');
    }

    const row = spot[0];
    const council = row.councilId
      ? (((await this.dataSource.query(
          `
            SELECT
              id,
              name,
              source_url AS "sourceUrl",
              center_lat AS "centerLat",
              center_lon AS "centerLon",
              coverage_radius_m AS "coverageRadiusM",
              default_fee_state AS "defaultFeeState",
              default_note AS "defaultNote"
            FROM parking_councils
            WHERE id = $1
            LIMIT 1
          `,
          [row.councilId],
        )) as ParkingCouncilRow[])[0] ?? null)
      : null;

    const localities =
      council?.id != null
        ? ((await this.dataSource.query(
            `
              SELECT
                id,
                council_id AS "councilId",
                label,
                center_lat AS "centerLat",
                center_lon AS "centerLon",
                radius_m AS "radiusM",
                default_fee_state AS "defaultFeeState",
                default_note AS "defaultNote"
              FROM parking_locality_overrides
              WHERE council_id = $1
            `,
            [council.id],
          )) as ParkingLocalityRow[])
        : [];

    const localityIds = localities.map((locality) => locality.id);
    const timeBands =
      council?.id != null || localityIds.length
        ? ((await this.dataSource.query(
            `
              SELECT
                id,
                scope_type AS "scopeType",
                scope_id AS "scopeId",
                day_mask AS "dayMask",
                start_time AS "startTime",
                end_time AS "endTime",
                fee_state AS "feeState",
                note
              FROM parking_time_bands
              WHERE
                (scope_type = 'council' AND scope_id = $1)
                OR
                (scope_type = 'locality' AND scope_id = ANY($2))
            `,
            [council?.id ?? '', localityIds],
          )) as ParkingTimeBandRow[])
        : [];

    const item = this.toSearchItem(
      row,
      council,
      localities,
      timeBands.reduce<Record<string, ParkingTimeBandRow[]>>((acc, timeBand) => {
        (acc[`${timeBand.scopeType}:${timeBand.scopeId}`] ||= []).push(timeBand);
        return acc;
      }, {}),
      this.resolveTimeContext(at),
    );

    return {
      item,
    };
  }

  async ingestBootstrap(limit?: number) {
    const safeLimit = Math.min(Math.max(limit ?? 12, 1), 60);
    const councils = (await this.dataSource.query(
      `
        SELECT id
        FROM parking_councils
        ORDER BY name ASC
        LIMIT $1
      `,
      [safeLimit],
    )) as Array<{ id: string }>;

    const items = [];
    for (const council of councils) {
      items.push(await this.ingestCouncil(council.id));
    }

    return {
      items,
      meta: {
        total: items.length,
        imported: items.reduce((acc, item) => acc + (item.imported ?? 0), 0),
      },
    };
  }

  async syncAtlasFromRepository() {
    const { councils, rules } = await this.loadAtlasFiles();
    const ruleMap = new Map(rules.map((rule) => [rule.councilId, rule]));
    const councilIds = councils.map((council) => council.id);

    await this.dataSource.transaction(async (manager) => {
      if (councilIds.length) {
        await manager.query(
          `
            DELETE FROM parking_time_bands
            WHERE
              (scope_type = 'council' AND scope_id = ANY($1))
              OR
              (
                scope_type = 'locality'
                AND scope_id IN (
                  SELECT id FROM parking_locality_overrides WHERE council_id = ANY($1)
                )
              )
          `,
          [councilIds],
        );
        await manager.query(
          `
            DELETE FROM parking_locality_overrides
            WHERE council_id = ANY($1)
          `,
          [councilIds],
        );
      }

      for (const council of councils) {
        const rule = ruleMap.get(council.id);
        await manager.query(
          `
            INSERT INTO parking_councils (
              id,
              name,
              source_url,
              center_lat,
              center_lon,
              coverage_radius_m,
              default_fee_state,
              default_note,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              source_url = EXCLUDED.source_url,
              center_lat = EXCLUDED.center_lat,
              center_lon = EXCLUDED.center_lon,
              coverage_radius_m = EXCLUDED.coverage_radius_m,
              default_fee_state = EXCLUDED.default_fee_state,
              default_note = EXCLUDED.default_note,
              updated_at = now()
          `,
          [
            council.id,
            council.name,
            rule?.sourceURL ?? null,
            council.lat,
            council.lon,
            council.coverageRadiusMeters ?? null,
            this.normalizeFeeState(rule?.defaultRoadsideFee),
            rule?.defaultRoadsideNote ?? null,
          ],
        );

        const councilTimeBands = rule?.timeBands ?? [];
        for (let index = 0; index < councilTimeBands.length; index += 1) {
          const timeBand = councilTimeBands[index];
          await manager.query(
            `
              INSERT INTO parking_time_bands (
                id,
                scope_type,
                scope_id,
                day_mask,
                start_time,
                end_time,
                fee_state,
                note,
                updated_at
              )
              VALUES ($1, 'council', $2, $3, $4, $5, $6, $7, now())
              ON CONFLICT (id) DO UPDATE SET
                day_mask = EXCLUDED.day_mask,
                start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time,
                fee_state = EXCLUDED.fee_state,
                note = EXCLUDED.note,
                updated_at = now()
            `,
            [
              `${council.id}:band:${index + 1}`,
              council.id,
              this.dayMaskForAtlas(timeBand.days),
              timeBand.start,
              timeBand.end,
              this.normalizeFeeState(timeBand.roadsideFee),
              timeBand.roadsideNote ?? null,
            ],
          );
        }

        const localityOverrides = rule?.localityOverrides ?? [];
        for (const locality of localityOverrides) {
          const localityId = `${council.id}:${this.slugify(locality.label)}`;
          await manager.query(
            `
              INSERT INTO parking_locality_overrides (
                id,
                council_id,
                label,
                center_lat,
                center_lon,
                radius_m,
                default_fee_state,
                default_note,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
              ON CONFLICT (id) DO UPDATE SET
                council_id = EXCLUDED.council_id,
                label = EXCLUDED.label,
                center_lat = EXCLUDED.center_lat,
                center_lon = EXCLUDED.center_lon,
                radius_m = EXCLUDED.radius_m,
                default_fee_state = EXCLUDED.default_fee_state,
                default_note = EXCLUDED.default_note,
                updated_at = now()
            `,
            [
              localityId,
              council.id,
              locality.label,
              locality.lat,
              locality.lon,
              locality.radiusMeters,
              this.normalizeFeeState(locality.roadsideFee),
              locality.roadsideNote ?? null,
            ],
          );

          const localityTimeBands = locality.timeBands ?? [];
          for (let index = 0; index < localityTimeBands.length; index += 1) {
            const timeBand = localityTimeBands[index];
            await manager.query(
              `
                INSERT INTO parking_time_bands (
                  id,
                  scope_type,
                  scope_id,
                  day_mask,
                  start_time,
                  end_time,
                  fee_state,
                  note,
                  updated_at
                )
                VALUES ($1, 'locality', $2, $3, $4, $5, $6, $7, now())
                ON CONFLICT (id) DO UPDATE SET
                  day_mask = EXCLUDED.day_mask,
                  start_time = EXCLUDED.start_time,
                  end_time = EXCLUDED.end_time,
                  fee_state = EXCLUDED.fee_state,
                  note = EXCLUDED.note,
                  updated_at = now()
              `,
              [
                `${localityId}:band:${index + 1}`,
                localityId,
                this.dayMaskForAtlas(timeBand.days),
                timeBand.start,
                timeBand.end,
                this.normalizeFeeState(timeBand.roadsideFee),
                timeBand.roadsideNote ?? null,
              ],
            );
          }
        }
      }

      await manager.query(
        `
          INSERT INTO parking_source_snapshots (
            id,
            source,
            scope,
            version,
            fetched_at,
            status,
            metadata
          )
          VALUES ($1, $2, $3, $4, now(), $5, $6::jsonb)
        `,
        [
          `atlas-sync:${new Date().toISOString()}`,
          'repo-json',
          'atlas',
          'v1',
          'success',
          JSON.stringify({
            councils: councils.length,
            rules: rules.length,
          }),
        ],
      );
    });

    return {
      source: 'repo-json',
      councils: councils.length,
      rules: rules.length,
      localities: rules.reduce((acc, rule) => acc + (rule.localityOverrides?.length ?? 0), 0),
    };
  }

  async importCouncilFeed(body: ParkingImportCouncilDto) {
    const councilId = body.councilId?.trim().toLowerCase();
    if (!councilId) {
      throw new BadRequestException('councilId is required');
    }
    if (!body.sourceUrl && !body.sourceFile) {
      throw new BadRequestException('sourceUrl or sourceFile is required');
    }

    const raw = body.sourceFile
      ? await readFile(path.resolve(body.sourceFile), 'utf8')
      : await this.fetchText(body.sourceUrl!);
    const format = body.format ?? this.inferFormat(body.sourceUrl ?? body.sourceFile ?? '');
    const mode = body.mode ?? 'flat_rows';

    const parsed =
      format === 'csv'
        ? this.parseCSV(raw)
        : (JSON.parse(raw) as unknown);

    const rule = this.normalizeCouncilFeed({
      councilId,
      payload: parsed,
      mode,
      sourceUrl: body.sourceUrl ?? body.sourceFile,
    });

    const council = (((await this.dataSource.query(
      `
        SELECT
          id,
          name,
          source_url AS "sourceUrl",
          center_lat AS "centerLat",
          center_lon AS "centerLon",
          coverage_radius_m AS "coverageRadiusM",
          default_fee_state AS "defaultFeeState",
          default_note AS "defaultNote"
        FROM parking_councils
        WHERE id = $1
        LIMIT 1
      `,
      [councilId],
    )) as ParkingCouncilRow[])[0] ?? null);

    if (!council) {
      throw new NotFoundException('Parking council not found');
    }

    await this.replaceCouncilRuleData(council, rule);

    return {
      council: {
        id: council.id,
        name: council.name,
      },
      source: body.sourceUrl ?? body.sourceFile ?? null,
      mode,
      format,
      localities: rule.localityOverrides?.length ?? 0,
      timeBands:
        (rule.timeBands?.length ?? 0) +
        (rule.localityOverrides ?? []).reduce(
          (acc, locality) => acc + (locality.timeBands?.length ?? 0),
          0,
        ),
    };
  }

  async ingestCouncil(
    councilId: string,
    radiusOverrideM?: number,
    maxResults?: number,
  ) {
    const normalizedCouncilId = councilId.trim().toLowerCase();
    if (!normalizedCouncilId) {
      throw new BadRequestException('Council id is required');
    }

    const council = (((await this.dataSource.query(
      `
        SELECT
          id,
          name,
          source_url AS "sourceUrl",
          center_lat AS "centerLat",
          center_lon AS "centerLon",
          coverage_radius_m AS "coverageRadiusM",
          default_fee_state AS "defaultFeeState",
          default_note AS "defaultNote"
        FROM parking_councils
        WHERE id = $1
        LIMIT 1
      `,
      [normalizedCouncilId],
    )) as ParkingCouncilRow[])[0] ?? null);

    if (!council) {
      throw new NotFoundException('Parking council not found');
    }

    const localities = (await this.dataSource.query(
      `
        SELECT
          id,
          council_id AS "councilId",
          label,
          center_lat AS "centerLat",
          center_lon AS "centerLon",
          radius_m AS "radiusM",
          default_fee_state AS "defaultFeeState",
          default_note AS "defaultNote"
        FROM parking_locality_overrides
        WHERE council_id = $1
        ORDER BY radius_m DESC, label ASC
      `,
      [council.id],
    )) as ParkingLocalityRow[];

    const seedAreas: IngestSeedArea[] = localities.length
      ? localities.map((locality) => ({
          id: locality.id,
          label: locality.label,
          lat: locality.centerLat,
          lon: locality.centerLon,
          radiusM: this.resolveIngestRadius(radiusOverrideM, locality.radiusM),
        }))
      : [
          {
            id: council.id,
            label: council.name,
            lat: council.centerLat,
            lon: council.centerLon,
            radiusM: this.resolveIngestRadius(
              radiusOverrideM,
              council.coverageRadiusM ?? 3000,
            ),
          },
        ];

    const spotMap = new Map<string, ParkingSpotRow>();
    const seedStats: Array<{ area: string; imported: number }> = [];
    const effectiveMaxResults = Math.min(Math.max(maxResults ?? 240, 25), 800);

    for (const area of seedAreas) {
      const query = this.buildOverpassIngestQuery(area.lat, area.lon, area.radiusM);
      const response = await fetch(this.overpassEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'User-Agent': 'Drivest-Backend/1.0 (+https://drivest.uk)',
        },
        body: `data=${this.percentEncodeForForm(query)}`,
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Parking ingest failed for ${area.label}: Overpass returned ${response.status}`,
        );
      }

      const payload = (await response.json()) as { elements?: OverpassElement[] };
      const importedFromArea = this.mapOverpassElementsToSpots(
        payload.elements ?? [],
        council.id,
        effectiveMaxResults,
      );

      for (const spot of importedFromArea) {
        const existing = spotMap.get(spot.id);
        if (!existing || spot.confidence > existing.confidence) {
          spotMap.set(spot.id, spot);
        }
      }
      seedStats.push({ area: area.label, imported: importedFromArea.length });
    }

    const spots = Array.from(spotMap.values());
    for (const spot of spots) {
      await this.dataSource.query(
        `
          INSERT INTO parking_spots (
            id,
            council_id,
            title,
            lat,
            lon,
            geom,
            spot_type,
            source,
            source_ref,
            accessibility,
            base_fee_state,
            confidence_score,
            raw_tags,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12::jsonb,
            now()
          )
          ON CONFLICT (id) DO UPDATE SET
            council_id = EXCLUDED.council_id,
            title = EXCLUDED.title,
            lat = EXCLUDED.lat,
            lon = EXCLUDED.lon,
            geom = EXCLUDED.geom,
            spot_type = EXCLUDED.spot_type,
            source = EXCLUDED.source,
            source_ref = EXCLUDED.source_ref,
            accessibility = EXCLUDED.accessibility,
            base_fee_state = EXCLUDED.base_fee_state,
            confidence_score = EXCLUDED.confidence_score,
            raw_tags = EXCLUDED.raw_tags,
            updated_at = now()
        `,
        [
          spot.id,
          spot.councilId,
          spot.title,
          spot.lat,
          spot.lon,
          spot.spotType,
          spot.source,
          spot.sourceRef,
          spot.accessible,
          spot.baseFeeState,
          spot.confidence,
          JSON.stringify(spot.rawTags ?? {}),
        ],
      );
    }

    await this.dataSource.query(
      `
        INSERT INTO parking_source_snapshots (
          id,
          source,
          scope,
          version,
          fetched_at,
          status,
          metadata
        )
        VALUES ($1, $2, $3, $4, now(), $5, $6::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          fetched_at = EXCLUDED.fetched_at,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata
      `,
      [
        `osm:${council.id}:${new Date().toISOString()}`,
        'osm',
        `council:${council.id}`,
        'v1',
        'success',
        JSON.stringify({
          councilId: council.id,
          imported: spots.length,
          seedAreas: seedStats,
        }),
      ],
    );

    return {
      council: {
        id: council.id,
        name: council.name,
      },
      imported: spots.length,
      seedAreas: seedStats,
    };
  }

  private resolveBounds(dto: ParkingSearchDto) {
    const minLat = Number(dto.min_lat);
    const minLon = Number(dto.min_lon);
    const maxLat = Number(dto.max_lat);
    const maxLon = Number(dto.max_lon);

    if (
      Number.isNaN(minLat) ||
      Number.isNaN(minLon) ||
      Number.isNaN(maxLat) ||
      Number.isNaN(maxLon)
    ) {
      throw new BadRequestException('Parking search bounds are invalid');
    }
    if (minLat >= maxLat || minLon >= maxLon) {
      throw new BadRequestException('Parking search bounds must form a valid box');
    }

    return { minLat, minLon, maxLat, maxLon };
  }

  private resolveCenter(
    dto: ParkingSearchDto,
    bounds: { minLat: number; minLon: number; maxLat: number; maxLon: number },
  ) {
    const lat =
      dto.center_lat ??
      (bounds.minLat + bounds.maxLat) / 2;
    const lon =
      dto.center_lon ??
      (bounds.minLon + bounds.maxLon) / 2;
    return { lat, lon };
  }

  private async resolveAreaCouncil(lat: number, lon: number): Promise<ParkingCouncilRow | null> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          id,
          name,
          source_url AS "sourceUrl",
          center_lat AS "centerLat",
          center_lon AS "centerLon",
          coverage_radius_m AS "coverageRadiusM",
          default_fee_state AS "defaultFeeState",
          default_note AS "defaultNote",
          ST_Distance(
            ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) AS "distanceM"
        FROM parking_councils
        WHERE
          coverage_radius_m IS NULL
          OR ST_DWithin(
            ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            coverage_radius_m
          )
        ORDER BY "distanceM" ASC
        LIMIT 1
      `,
      [lon, lat],
    )) as ParkingCouncilRow[];

    return rows[0] ?? null;
  }

  private toSearchItem(
    spot: ParkingSpotRow,
    council: ParkingCouncilRow | null,
    localities: ParkingLocalityRow[],
    timeBandsByScope: Record<string, ParkingTimeBandRow[]>,
    timeContext: TimeContext,
  ) {
    const matchingLocality =
      localities.find(
        (locality) =>
          this.haversineDistanceMeters(
            spot.lat,
            spot.lon,
            locality.centerLat,
            locality.centerLon,
          ) <= locality.radiusM,
      ) ?? null;

    const effectiveBaseState = matchingLocality?.defaultFeeState
      ?? council?.defaultFeeState
      ?? this.normalizeFeeState(spot.baseFeeState);
    const effectiveBaseNote = matchingLocality?.defaultNote
      ?? council?.defaultNote
      ?? null;
    const localityBands = matchingLocality
      ? timeBandsByScope[`locality:${matchingLocality.id}`] ?? []
      : [];
    const councilBands = council ? timeBandsByScope[`council:${council.id}`] ?? [] : [];
    const effectiveBands = localityBands.length ? localityBands : councilBands;
    const evaluated = this.evaluateTimeAwareStatus(
      effectiveBaseState,
      effectiveBaseNote,
      effectiveBands,
      timeContext,
    );

    return {
      id: spot.id,
      title: spot.title,
      lat: Number(spot.lat),
      lon: Number(spot.lon),
      spotType: spot.spotType,
      source: spot.source,
      sourceRef: spot.sourceRef,
      statusNow: evaluated.statusNow,
      statusLabel: evaluated.statusLabel,
      freeAfter: evaluated.freeAfter,
      nextChangeAt: evaluated.nextChangeAt,
      distanceM: Math.max(0, Math.round(Number(spot.distanceM) || 0)),
      accessible: spot.accessible,
      confidence: Number(spot.confidence),
      note: evaluated.note,
      council: council
        ? {
            id: council.id,
            name: council.name,
          }
        : null,
    };
  }

  private evaluateTimeAwareStatus(
    baseState: FeeState,
    baseNote: string | null,
    timeBands: ParkingTimeBandRow[],
    timeContext: TimeContext,
  ) {
    const todaysBands = timeBands
      .filter((timeBand) => this.timeBandAppliesToday(timeBand.dayMask, timeContext.dayCode))
      .map((timeBand) => ({
        ...timeBand,
        startMinutes: this.parseClockMinutes(timeBand.startTime),
        endMinutes: this.parseClockMinutes(timeBand.endTime),
      }))
      .filter(
        (timeBand) =>
          timeBand.startMinutes !== null && timeBand.endMinutes !== null,
      )
      .sort((left, right) => (left.startMinutes ?? 0) - (right.startMinutes ?? 0));

    const activeBand = todaysBands.find(
      (timeBand) =>
        (timeBand.startMinutes ?? -1) <= timeContext.minuteOfDay &&
        timeContext.minuteOfDay < (timeBand.endMinutes ?? -1),
    );

    if (activeBand) {
      const end = this.formatClock(activeBand.endMinutes ?? 0);
      return {
        statusNow: activeBand.feeState,
        statusLabel: `${this.labelForStatus(activeBand.feeState)} now until ${end}`,
        freeAfter: activeBand.feeState === 'paid' ? end : null,
        nextChangeAt: end,
        note: [activeBand.note, baseNote].filter(Boolean).join(' '),
      };
    }

    const nextBand = todaysBands.find(
      (timeBand) => (timeBand.startMinutes ?? 1441) > timeContext.minuteOfDay,
    );

    if (nextBand) {
      const start = this.formatClock(nextBand.startMinutes ?? 0);
      const statusLabel =
        baseState === 'free'
          ? `Free now, ${this.labelForStatus(nextBand.feeState).toLowerCase()} from ${start}`
          : `${this.labelForStatus(baseState)} now, ${this.labelForStatus(nextBand.feeState).toLowerCase()} from ${start}`;
      return {
        statusNow: baseState,
        statusLabel,
        freeAfter: nextBand.feeState === 'free' ? start : null,
        nextChangeAt: start,
        note: [baseNote, nextBand.note].filter(Boolean).join(' '),
      };
    }

    return {
      statusNow: baseState,
      statusLabel: `${this.labelForStatus(baseState)} now`,
      freeAfter: null,
      nextChangeAt: null,
      note: baseNote ?? null,
    };
  }

  private resolveTimeContext(at?: string): TimeContext {
    const value = at ? new Date(at) : new Date();
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException('Parking query time is invalid');
    }

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(value);
    const weekday = (parts.find((part) => part.type === 'weekday')?.value ?? 'mon')
      .slice(0, 3)
      .toLowerCase();
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

    return {
      iso: value.toISOString(),
      dayCode: weekday,
      minuteOfDay: hour * 60 + minute,
    };
  }

  private timeBandAppliesToday(dayMask: string, dayCode: string) {
    const tokens = dayMask
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (!tokens.length || tokens.includes('all') || tokens.includes('daily')) {
      return true;
    }
    if (tokens.includes(dayCode)) {
      return true;
    }
    if (tokens.includes('weekdays') && ['mon', 'tue', 'wed', 'thu', 'fri'].includes(dayCode)) {
      return true;
    }
    if (tokens.includes('weekend') && ['sat', 'sun'].includes(dayCode)) {
      return true;
    }
    return false;
  }

  private parseClockMinutes(value: string) {
    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }
    return hour * 60 + minute;
  }

  private formatClock(minutes: number) {
    const safe = Math.max(0, minutes);
    const hour = Math.floor(safe / 60);
    const minute = safe % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private labelForStatus(status: FeeState) {
    switch (status) {
      case 'free':
        return 'Free';
      case 'paid':
        return 'Paid';
      case 'restricted':
        return 'Restricted';
      case 'unknown':
      default:
        return 'Unknown';
    }
  }

  private normalizeFeeState(value: string | null | undefined): FeeState {
    switch ((value ?? '').trim().toLowerCase()) {
      case 'free':
      case 'likelyfree':
      case 'likely_free':
        return 'free';
      case 'paid':
      case 'likelypaid':
      case 'likely_paid':
        return 'paid';
      case 'restricted':
        return 'restricted';
      default:
        return 'unknown';
    }
  }

  private haversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;
    const earthRadius = 6371_000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
  }

  private resolveIngestRadius(radiusOverrideM: number | undefined, fallbackRadiusM: number) {
    if (radiusOverrideM && Number.isFinite(radiusOverrideM)) {
      return Math.min(Math.max(Math.round(radiusOverrideM), 1000), 8000);
    }
    return Math.min(Math.max(Math.round(fallbackRadiusM + 1200), 1800), 5000);
  }

  private buildOverpassIngestQuery(lat: number, lon: number, radiusM: number) {
    return `
      [out:json][timeout:25];
      (
        nwr(around:${radiusM},${lat},${lon})["amenity"="parking"]["access"!="private"];
        nwr(around:${radiusM},${lat},${lon})["amenity"="parking_space"]["access"!="private"];
        nwr(around:${radiusM},${lat},${lon})["parking"="street_side"]["access"!="private"];
        nwr(around:${radiusM},${lat},${lon})["parking"="surface"]["access"!="private"];
        nwr(around:${radiusM},${lat},${lon})["parking"="underground"]["access"!="private"];
        nwr(around:${radiusM},${lat},${lon})["parking"="multi-storey"]["access"!="private"];
        nwr(around:${radiusM},${lat},${lon})["parking"="lane"]["access"!="private"];
        way(around:${radiusM},${lat},${lon})[~"^parking(:lane)?:(left|right|both)$"~"."];
        way(around:${radiusM},${lat},${lon})[~"^parking:condition(:left|:right|:both)?(:fee)?$"~"."];
      );
      out body center;
    `;
  }

  private percentEncodeForForm(value: string) {
    return encodeURIComponent(value)
      .replace(/%20/g, '+')
      .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  private mapOverpassElementsToSpots(
    elements: OverpassElement[],
    councilId: string,
    maxResults: number,
  ): ParkingSpotRow[] {
    const deduped = new Map<string, ParkingSpotRow>();
    for (const element of elements) {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (lat == null || lon == null) {
        continue;
      }
      const tags = element.tags ?? {};
      if (!this.isPublicParking(tags)) {
        continue;
      }

      const id = `osm:${element.type}:${element.id}`;
      deduped.set(id, {
        id,
        councilId,
        title: this.parkingTitle(tags),
        lat,
        lon,
        spotType: this.parkingSpotType(tags),
        source: 'osm',
        sourceRef: `${element.type}/${element.id}`,
        baseFeeState: this.inferFeeState(tags),
        accessible: this.isAccessible(tags),
        confidence: this.confidenceScore(tags),
        rawTags: tags,
        updatedAt: new Date(),
        distanceM: 0,
      });
      if (deduped.size >= maxResults) {
        break;
      }
    }
    return Array.from(deduped.values());
  }

  private isPublicParking(tags: Record<string, string>) {
    const access = (tags.access ?? '').trim().toLowerCase();
    if (['private', 'residents', 'permit', 'customers'].includes(access)) {
      return false;
    }
    if (tags.amenity === 'parking' || tags.amenity === 'parking_space') {
      return true;
    }
    if (
      tags.parking === 'street_side' ||
      tags.parking === 'surface' ||
      tags.parking === 'underground' ||
      tags.parking === 'multi-storey' ||
      tags.parking === 'lane'
    ) {
      return true;
    }
    return Object.keys(tags).some((key) => key.startsWith('parking:lane') || key.startsWith('parking:condition'));
  }

  private parkingTitle(tags: Record<string, string>) {
    const name = tags.name?.trim();
    if (name) {
      return name;
    }
    if (tags.amenity === 'parking_space' || tags.parking === 'lane') {
      return 'Roadside parking';
    }
    if (tags.parking === 'multi-storey') {
      return 'Multi-storey parking';
    }
    if (tags.parking === 'underground') {
      return 'Underground parking';
    }
    if (tags.parking === 'surface') {
      return 'Surface car park';
    }
    return 'Parking';
  }

  private parkingSpotType(tags: Record<string, string>) {
    if (tags.amenity === 'parking_space' || tags.parking === 'lane' || tags.parking === 'street_side') {
      return 'roadside';
    }
    if (tags.parking === 'multi-storey') {
      return 'multi_storey';
    }
    if (tags.parking === 'underground') {
      return 'underground';
    }
    return 'car_park';
  }

  private inferFeeState(tags: Record<string, string>): FeeState {
    const paidIndicators = [
      tags.fee,
      tags['parking:fee'],
      tags.charge,
      tags['parking:condition:fee'],
      tags['payment:cash'],
      tags['payment:credit_cards'],
      tags['payment:app'],
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());

    if (paidIndicators.some((value) => ['yes', 'paid'].includes(value) || /^\d/.test(value))) {
      return 'paid';
    }

    const freeIndicators = [
      tags.fee,
      tags['parking:fee'],
      tags['parking:condition:fee'],
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());

    if (freeIndicators.some((value) => ['no', 'free'].includes(value))) {
      return 'free';
    }

    return 'unknown';
  }

  private isAccessible(tags: Record<string, string>) {
    const wheelchair = (tags.wheelchair ?? '').trim().toLowerCase();
    return wheelchair === 'yes' || wheelchair === 'designated';
  }

  private confidenceScore(tags: Record<string, string>) {
    let score = 45;
    if (tags.name) score += 10;
    if (tags.fee || tags['parking:fee'] || tags.charge) score += 20;
    if (tags.capacity) score += 5;
    if (tags.operator) score += 5;
    if (tags.amenity === 'parking' || tags.amenity === 'parking_space') score += 10;
    return Math.min(score, 95);
  }

  private async replaceCouncilRuleData(council: ParkingCouncilRow, rule: AtlasRuleRecord) {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `
          DELETE FROM parking_time_bands
          WHERE
            (scope_type = 'council' AND scope_id = $1)
            OR
            (
              scope_type = 'locality'
              AND scope_id IN (
                SELECT id FROM parking_locality_overrides WHERE council_id = $1
              )
            )
        `,
        [council.id],
      );
      await manager.query(
        `
          DELETE FROM parking_locality_overrides
          WHERE council_id = $1
        `,
        [council.id],
      );

      await manager.query(
        `
          UPDATE parking_councils
          SET
            source_url = $2,
            default_fee_state = $3,
            default_note = $4,
            updated_at = now()
          WHERE id = $1
        `,
        [
          council.id,
          rule.sourceURL ?? council.sourceUrl ?? null,
          this.normalizeFeeState(rule.defaultRoadsideFee ?? council.defaultFeeState),
          rule.defaultRoadsideNote ?? council.defaultNote ?? null,
        ],
      );

      const councilTimeBands = rule.timeBands ?? [];
      for (let index = 0; index < councilTimeBands.length; index += 1) {
        const timeBand = councilTimeBands[index];
        await manager.query(
          `
            INSERT INTO parking_time_bands (
              id,
              scope_type,
              scope_id,
              day_mask,
              start_time,
              end_time,
              fee_state,
              note,
              updated_at
            )
            VALUES ($1, 'council', $2, $3, $4, $5, $6, $7, now())
          `,
          [
            `${council.id}:imported-band:${index + 1}`,
            council.id,
            this.dayMaskForAtlas(timeBand.days),
            timeBand.start,
            timeBand.end,
            this.normalizeFeeState(timeBand.roadsideFee),
            timeBand.roadsideNote ?? null,
          ],
        );
      }

      const localityOverrides = rule.localityOverrides ?? [];
      for (let localityIndex = 0; localityIndex < localityOverrides.length; localityIndex += 1) {
        const locality = localityOverrides[localityIndex];
        const localityId = `${council.id}:${this.slugify(locality.label)}`;
        await manager.query(
          `
            INSERT INTO parking_locality_overrides (
              id,
              council_id,
              label,
              center_lat,
              center_lon,
              radius_m,
              default_fee_state,
              default_note,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
          `,
          [
            localityId,
            council.id,
            locality.label,
            locality.lat,
            locality.lon,
            locality.radiusMeters,
            this.normalizeFeeState(locality.roadsideFee),
            locality.roadsideNote ?? null,
          ],
        );

        const localityTimeBands = locality.timeBands ?? [];
        for (let bandIndex = 0; bandIndex < localityTimeBands.length; bandIndex += 1) {
          const timeBand = localityTimeBands[bandIndex];
          await manager.query(
            `
              INSERT INTO parking_time_bands (
                id,
                scope_type,
                scope_id,
                day_mask,
                start_time,
                end_time,
                fee_state,
                note,
                updated_at
              )
              VALUES ($1, 'locality', $2, $3, $4, $5, $6, $7, now())
            `,
            [
              `${localityId}:imported-band:${bandIndex + 1}`,
              localityId,
              this.dayMaskForAtlas(timeBand.days),
              timeBand.start,
              timeBand.end,
              this.normalizeFeeState(timeBand.roadsideFee),
              timeBand.roadsideNote ?? null,
            ],
          );
        }
      }

      await manager.query(
        `
          INSERT INTO parking_source_snapshots (
            id,
            source,
            scope,
            version,
            fetched_at,
            status,
            metadata
          )
          VALUES ($1, $2, $3, $4, now(), $5, $6::jsonb)
        `,
        [
          `atlas-import:${council.id}:${new Date().toISOString()}`,
          'council-import',
          `council:${council.id}`,
          'v1',
          'success',
          JSON.stringify({
            councilId: council.id,
            localities: rule.localityOverrides?.length ?? 0,
          }),
        ],
      );
    });
  }

  private async loadAtlasFiles() {
    const councilsPath = await this.resolveAtlasFilePath('parking_councils.json');
    const rulesPath = await this.resolveAtlasFilePath('parking_council_rules.json');
    const [councilsRaw, rulesRaw] = await Promise.all([
      readFile(councilsPath, 'utf8'),
      readFile(rulesPath, 'utf8'),
    ]);

    return {
      councils: JSON.parse(councilsRaw) as AtlasCouncilRecord[],
      rules: JSON.parse(rulesRaw) as AtlasRuleRecord[],
    };
  }

  private async resolveAtlasFilePath(fileName: string) {
    const candidates = [
      path.resolve(process.cwd(), '..', 'ios', 'DrivestNavigation', 'Resources', 'Data', fileName),
      path.resolve(process.cwd(), 'ios', 'DrivestNavigation', 'Resources', 'Data', fileName),
    ];

    for (const candidate of candidates) {
      try {
        await readFile(candidate, 'utf8');
        return candidate;
      } catch {
        continue;
      }
    }

    throw new NotFoundException(`Parking atlas file not found: ${fileName}`);
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private dayMaskForAtlas(days?: string[]) {
    if (!days?.length) {
      return 'daily';
    }
    return days
      .map((day) => day.trim().toLowerCase())
      .filter(Boolean)
      .join(',');
  }

  private async fetchText(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new BadRequestException(`Council feed fetch failed with status ${response.status}`);
    }
    return response.text();
  }

  private inferFormat(source: string): 'json' | 'csv' {
    return source.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
  }

  private normalizeCouncilFeed(input: {
    councilId: string;
    payload: unknown;
    mode: 'normalized' | 'flat_rows';
    sourceUrl?: string;
  }): AtlasRuleRecord {
    if (input.mode === 'normalized') {
      const payload = input.payload as AtlasRuleRecord | AtlasRuleRecord[];
      const record = Array.isArray(payload)
        ? payload.find((item) => item.councilId === input.councilId)
        : payload;
      if (!record || record.councilId !== input.councilId) {
        throw new BadRequestException('Normalized council feed does not match councilId');
      }
      return {
        ...record,
        sourceURL: record.sourceURL ?? input.sourceUrl,
      };
    }

    const rows = Array.isArray(input.payload) ? (input.payload as FlatAtlasRuleRow[]) : [];
    if (!rows.length) {
      throw new BadRequestException('Flat council feed is empty');
    }

    const localityOverrides = rows.map((row) => {
      const radiusMeters = Number(row.radiusMeters ?? 1500);
      const lat = Number(row.lat);
      const lon = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new BadRequestException('Flat council feed contains invalid lat/lon values');
      }
      const start = row.start?.trim();
      const end = row.end?.trim();
      const timeBands =
        start && end
          ? [
              {
                days: this.normalizeFlatDays(row.days),
                start,
                end,
                roadsideFee: row.roadsideFee ?? 'likelyPaid',
                roadsideNote: row.roadsideNote ?? null,
              },
            ]
          : [];
      return {
        label: row.label,
        lat,
        lon,
        radiusMeters: Number.isFinite(radiusMeters) ? radiusMeters : 1500,
        roadsideFee: row.roadsideFee ?? 'likelyPaid',
        roadsideNote: row.roadsideNote ?? null,
        timeBands,
      };
    });

    return {
      councilId: input.councilId,
      sourceURL: input.sourceUrl,
      defaultRoadsideFee: 'likelyFree',
      defaultRoadsideNote: 'Imported council rule feed.',
      localityOverrides,
    };
  }

  private normalizeFlatDays(value: string[] | string | undefined) {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return ['daily'];
  }

  private parseCSV(raw: string) {
    const rows: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let index = 0; index < raw.length; index += 1) {
      const char = raw[index];
      const next = raw[index + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && char === ',') {
        current.push(field);
        field = '';
        continue;
      }
      if (!inQuotes && (char === '\n' || char === '\r')) {
        if (char === '\r' && next === '\n') {
          index += 1;
        }
        current.push(field);
        if (current.some((value) => value.length > 0)) {
          rows.push(current);
        }
        current = [];
        field = '';
        continue;
      }
      field += char;
    }

    current.push(field);
    if (current.some((value) => value.length > 0)) {
      rows.push(current);
    }
    if (!rows.length) {
      return [];
    }

    const headers = rows[0].map((header) => header.trim());
    return rows.slice(1).map((values) => {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = (values[index] ?? '').trim();
      });
      return row;
    });
  }
}
