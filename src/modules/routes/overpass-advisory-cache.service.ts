import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import {
  NearbyHazardsResult,
  OsmSourceStatus,
  ROAD_HAZARD_TYPES,
  RoadHazardItem,
  RoadHazardType,
  RouteHazardsV1,
} from './road-hazard.service';

type OverpassElement = {
  id?: number | string;
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, unknown>;
};

type OverpassResponse = {
  osm3s?: {
    timestamp_osm_base?: string;
  };
  elements?: OverpassElement[];
};

type AdvisoryFeature = {
  id: string;
  osmType: string;
  osmId: number;
  hazardType: RoadHazardType;
  lat: number;
  lon: number;
  priority: number;
  confidence: number;
  label: string | null;
  signTitle: string | null;
  signCode: string | null;
  signImagePath: string | null;
  source: 'osm_overpass';
  rawTags: Record<string, string>;
};

type CacheQueryRow = {
  id: string;
  source_status: string;
  fetched_at: Date | string;
  expires_at: Date | string;
  overpass_snapshot: Date | string | null;
};

type CacheFeatureRow = {
  id: string;
  hazard_type: string;
  lat: number | string;
  lon: number | string;
  priority: number | string;
  confidence: number | string;
  label: string | null;
  sign_title: string | null;
  sign_code: string | null;
  sign_image_path: string | null;
  dist_m: number | string | null;
};

type CachePayload = {
  query: CacheQueryRow;
  items: RoadHazardItem[];
};

type TroFeatureRow = {
  id: string;
  hazard_type: string;
  lat: number | string;
  lon: number | string;
  priority: number | string | null;
  confidence: number | string | null;
  label: string | null;
  dist_m: number | string | null;
};

type BboxInput = {
  south: number;
  west: number;
  north: number;
  east: number;
  corridorM: number;
  types: RoadHazardType[] | null;
  limit: number;
};

type MetadataTuple = [string | null, string | null, string | null];

const QUERY_SCHEMA_VERSION = 'advisory_cache_v1';

@Injectable()
export class OverpassAdvisoryCacheService {
  private readonly overpassEndpoint = 'https://overpass-api.de/api/interpreter';
  private readonly enabled = this.envBool('ADVISORY_OVERPASS_ENABLED', true);
  private readonly troEnabled = this.envBool('ADVISORY_TRO_ENABLED', true);
  private readonly timeoutMs = this.clampInt(
    Number(process.env.ADVISORY_OVERPASS_TIMEOUT_MS ?? 25_000),
    5000,
    60_000,
  );
  private readonly cacheTtlHours = this.clampInt(
    Number(process.env.ADVISORY_CACHE_TTL_HOURS ?? 168),
    1,
    24 * 90,
  );
  private troTableAvailable: boolean | null = null;
  private troTableCheckedAtMs = 0;
  constructor(private readonly dataSource: DataSource) {}

  computeRouteHash(rawCoordinates: any, rawGeojson?: any): string {
    const coordinates = this.normalizeCoordinates(rawCoordinates, rawGeojson);
    if (coordinates.length < 2) return 'no_route_geometry';
    const normalized = coordinates.map(([lon, lat]) => [
      Number(lon.toFixed(6)),
      Number(lat.toFixed(6)),
    ]);
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  async buildRouteHazards(
    rawCoordinates: any,
    options?: {
      corridorWidthM?: number;
      rawGeojson?: any;
      limit?: number;
      types?: RoadHazardType[] | string[] | null;
    },
  ): Promise<RouteHazardsV1> {
    const corridorWidthM = this.clamp(
      Number(options?.corridorWidthM ?? 45),
      20,
      220,
    );
    const limit = this.clampInt(Number(options?.limit ?? 300), 1, 600);
    const types = this.normalizeTypes(options?.types);
    const coordinates = this.normalizeCoordinates(rawCoordinates, options?.rawGeojson);
    const routeHash = this.computeRouteHash(rawCoordinates, options?.rawGeojson);

    if (coordinates.length < 2) {
      return {
        version: 'road_hazards_v1',
        generatedAt: new Date().toISOString(),
        corridorWidthM,
        routeHash,
        osmSnapshot: null,
        source_status: 'no_route_geometry',
        items: [],
      };
    }

    const bbox = this.computeExpandedBbox(coordinates, corridorWidthM + 170);
    const resolved = await this.resolveBbox({
      south: bbox.south,
      west: bbox.west,
      north: bbox.north,
      east: bbox.east,
      corridorM: Math.round(corridorWidthM),
      types,
      limit: Math.max(limit * 3, 300),
    });

    const corridorScoped = resolved.items
      .map((item) => ({
        item,
        routeDistM: this.minimumDistanceToRouteMeters(
          { lat: item.lat, lon: item.lon },
          coordinates,
        ),
      }))
      .filter(({ routeDistM }) => routeDistM <= corridorWidthM)
      .sort((a, b) => {
        if (a.item.priority !== b.item.priority) {
          return b.item.priority - a.item.priority;
        }
        return a.routeDistM - b.routeDistM;
      })
      .slice(0, limit)
      .map(({ item, routeDistM }) => ({
        ...item,
        distM: Math.round(routeDistM),
      }));

    return {
      version: 'road_hazards_v1',
      generatedAt: new Date().toISOString(),
      corridorWidthM,
      routeHash,
      osmSnapshot: this.toIsoStringOrNull(resolved.query?.overpass_snapshot ?? null),
      source_status: resolved.status,
      items: corridorScoped,
    };
  }

  async getNearbyHazards(params: {
    lat: number;
    lon: number;
    mode?: string;
    radiusM?: number;
    limit?: number;
    routeId?: string | null;
    routeCoordinates?: any;
    routeCorridorM?: number;
    types?: RoadHazardType[] | string[] | null;
    aheadOnly?: boolean;
    aheadDistanceM?: number;
    backtrackToleranceM?: number;
  }): Promise<NearbyHazardsResult> {
    const mode = String(params.mode ?? '').toUpperCase();
    const defaultRadius =
      mode === 'TO_START'
        ? 550
        : mode === 'ON_ROUTE'
          ? 450
          : mode === 'PREVIEW'
            ? 1800
            : 380;
    const maxRadius = mode === 'PREVIEW' ? 25_000 : 1500;
    const radiusM = this.clamp(Number(params.radiusM ?? defaultRadius), 80, maxRadius);
    const limit = this.clampInt(
      Number(params.limit ?? (mode === 'PREVIEW' ? 800 : 30)),
      1,
      mode === 'PREVIEW' ? 1200 : 120,
    );
    const routeCorridorM = this.clamp(Number(params.routeCorridorM ?? 120), 20, 500);
    const aheadOnly = Boolean(params.aheadOnly);
    const aheadDistanceM = this.clamp(Number(params.aheadDistanceM ?? 1200), 60, 10_000);
    const backtrackToleranceM = this.clamp(
      Number(params.backtrackToleranceM ?? 30),
      0,
      500,
    );
    const types = this.normalizeTypes(params.types);

    const bbox = this.computeRadiusBbox(params.lat, params.lon, radiusM + 120);
    const resolved = await this.resolveBbox({
      south: bbox.south,
      west: bbox.west,
      north: bbox.north,
      east: bbox.east,
      corridorM: Math.round(routeCorridorM),
      types,
      limit: Math.max(limit * 4, 300),
    });

    const routeCoordinates = this.normalizeCoordinates(params.routeCoordinates);
    const hasRoute = routeCoordinates.length >= 2;
    const routeLength = hasRoute ? this.routeLengthMeters(routeCoordinates) : 0;
    const currentProgress = hasRoute
      ? this.projectOntoRouteMeters(
          { lat: params.lat, lon: params.lon },
          routeCoordinates,
        ).progressM
      : 0;

    const filtered = resolved.items
      .map((item) => {
        const centerDist = this.haversineMeters(
          params.lat,
          params.lon,
          item.lat,
          item.lon,
        );
        const routeDistance = hasRoute
          ? this.minimumDistanceToRouteMeters(
              { lat: item.lat, lon: item.lon },
              routeCoordinates,
            )
          : centerDist;
        const progress = hasRoute
          ? this.projectOntoRouteMeters(
              { lat: item.lat, lon: item.lon },
              routeCoordinates,
            ).progressM
          : null;
        const aheadDist = progress == null ? null : progress - currentProgress;
        return {
          item,
          centerDist,
          routeDistance,
          aheadDist,
          routeLength,
        };
      })
      .filter(({ centerDist }) => centerDist <= radiusM)
      .filter(({ routeDistance }) => (hasRoute ? routeDistance <= routeCorridorM : true))
      .filter(({ aheadDist }) => {
        if (!hasRoute || !aheadOnly || aheadDist == null) return true;
        return aheadDist >= -backtrackToleranceM && aheadDist <= aheadDistanceM;
      })
      .sort((a, b) => {
        const aAhead = a.aheadDist ?? Number.POSITIVE_INFINITY;
        const bAhead = b.aheadDist ?? Number.POSITIVE_INFINITY;
        if (hasRoute && aAhead !== bAhead) return aAhead - bAhead;
        if (a.item.priority !== b.item.priority) return b.item.priority - a.item.priority;
        return a.centerDist - b.centerDist;
      })
      .slice(0, limit)
      .map(({ item, centerDist, aheadDist }) => {
        const mapped: RoadHazardItem = {
          ...item,
          distM: Math.round(centerDist),
        };
        if (aheadDist != null && Number.isFinite(aheadDist)) {
          mapped.aheadDistM = Math.round(aheadDist);
        }
        return mapped;
      });

    return {
      source_status: resolved.status,
      radiusM: Math.round(radiusM),
      items: filtered,
    };
  }

  private async resolveBbox(input: BboxInput): Promise<{
    status: OsmSourceStatus;
    query: CacheQueryRow | null;
    items: RoadHazardItem[];
  }> {
    if (!this.enabled) {
      return this.withCouncilTroData(input, {
        status: 'osm_unavailable',
        query: null,
        items: [],
      });
    }

    const queryKey = this.buildQueryKey(input);
    const fresh = await this.readCached(queryKey, false, input.limit);
    if (fresh) {
      await this.insertFetchRun({
        queryKey,
        cacheHit: true,
        status: fresh.query.source_status || 'ok',
        durationMs: 0,
        fetchedCount: fresh.items.length,
      });
      return this.withCouncilTroData(input, {
        status: this.toSourceStatus(fresh.query.source_status),
        query: fresh.query,
        items: fresh.items,
      });
    }

    const stale = await this.readCached(queryKey, true, input.limit);
    const refreshed = await this.refreshAndCache(queryKey, input);
    if (refreshed) {
      return this.withCouncilTroData(input, refreshed);
    }

    if (stale) {
      return this.withCouncilTroData(input, {
        status: this.toSourceStatus(stale.query.source_status),
        query: stale.query,
        items: stale.items,
      });
    }

    return this.withCouncilTroData(input, {
      status: 'osm_unavailable',
      query: null,
      items: [],
    });
  }

  private async refreshAndCache(
    queryKey: string,
    input: BboxInput,
  ): Promise<{
    status: OsmSourceStatus;
    query: CacheQueryRow | null;
    items: RoadHazardItem[];
  } | null> {
    const startedAt = Date.now();
    let fetchStatus = 'ok';
    let fetchError: string | undefined;
    let features: AdvisoryFeature[] = [];
    let overpassSnapshot: string | null = null;

    try {
      const prefilled = await this.readCached(queryKey, false, input.limit);
      if (prefilled) {
        await this.insertFetchRun({
          queryKey,
          cacheHit: true,
          status: prefilled.query.source_status || 'ok',
          durationMs: 0,
          fetchedCount: prefilled.items.length,
        });
        return {
          status: this.toSourceStatus(prefilled.query.source_status),
          query: prefilled.query,
          items: prefilled.items,
        };
      }

      const overpass = await this.fetchOverpass(input);
      overpassSnapshot = overpass.snapshot;
      features = overpass.items;
      const status: OsmSourceStatus = 'ok';
      await this.persistCacheRow({
        queryKey,
        input,
        status,
        features,
        snapshot: overpassSnapshot,
      });
    } catch (error) {
      fetchStatus = 'osm_unavailable';
      fetchError = (error as Error)?.message ?? 'Unknown advisory fetch failure';
    } finally {
      const durationMs = Math.max(0, Date.now() - startedAt);
      await this.insertFetchRun({
        queryKey,
        cacheHit: false,
        status: fetchStatus,
        durationMs,
        fetchedCount: features.length,
        error: fetchError,
        metadata: {
          snapshot: overpassSnapshot,
          bbox: {
            south: input.south,
            west: input.west,
            north: input.north,
            east: input.east,
          },
        },
      });
    }

    if (fetchStatus !== 'ok') {
      return null;
    }

    const fresh = await this.readCached(queryKey, false, input.limit);
    if (!fresh) {
      return null;
    }

    return {
      status: this.toSourceStatus(fresh.query.source_status),
      query: fresh.query,
      items: fresh.items,
    };
  }

  private async readCached(
    queryKey: string,
    includeStale: boolean,
    limit: number,
  ): Promise<CachePayload | null> {
    const queryRows = await this.dataSource.query<CacheQueryRow[]>(
      `
      SELECT
        q.id,
        q.source_status,
        q.fetched_at,
        q.expires_at,
        q.overpass_snapshot
      FROM advisory_query_cache q
      WHERE q.query_key = $1
      ${includeStale ? '' : 'AND q.expires_at > now()'}
      ORDER BY q.fetched_at DESC
      LIMIT 1
      `,
      [queryKey],
    );

    const query = queryRows?.[0];
    if (!query) return null;

    const featureRows = await this.dataSource.query<CacheFeatureRow[]>(
      `
      SELECT
        f.id,
        f.hazard_type,
        f.lat,
        f.lon,
        f.priority,
        f.confidence,
        f.label,
        f.sign_title,
        f.sign_code,
        f.sign_image_path,
        qf.dist_m
      FROM advisory_query_features qf
      JOIN advisory_features f ON f.id = qf.feature_id
      WHERE qf.query_id = $1
      ORDER BY f.priority DESC, COALESCE(qf.dist_m, 0) ASC
      LIMIT $2
      `,
      [query.id, Math.max(limit, 1)],
    );

    return {
      query,
      items: featureRows
        .map((row) => this.rowToRoadHazardItem(row))
        .filter((item): item is RoadHazardItem => item != null),
    };
  }

  private rowToRoadHazardItem(row: CacheFeatureRow): RoadHazardItem | null {
    const type = String(row.hazard_type || '') as RoadHazardType;
    if (!this.isAllowedHazardType(type)) return null;

    const lat = Number(row.lat);
    const lon = Number(row.lon);
    const priority = Number(row.priority);
    const confidence = Number(row.confidence);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const item: RoadHazardItem = {
      id: row.id,
      type,
      lat,
      lon,
      priority: Number.isFinite(priority) ? priority : this.priorityForType(type),
      source: 'osm',
      confidence: Number.isFinite(confidence)
        ? confidence
        : this.confidenceForType(type),
      labels: { primary: row.label ?? null },
    };

    const distM = Number(row.dist_m);
    if (Number.isFinite(distM)) {
      item.distM = Math.round(distM);
    }
    return item;
  }

  private async withCouncilTroData(
    input: BboxInput,
    base: {
      status: OsmSourceStatus;
      query: CacheQueryRow | null;
      items: RoadHazardItem[];
    },
  ): Promise<{
    status: OsmSourceStatus;
    query: CacheQueryRow | null;
    items: RoadHazardItem[];
  }> {
    if (!this.troEnabled) {
      return base;
    }

    try {
      const troItems = await this.loadCouncilTroFeatures(input);
      if (troItems.length === 0) {
        return base;
      }

      const merged = this.mergeTroItems(base.items, troItems);
      const status: OsmSourceStatus =
        base.status === 'osm_unavailable' && merged.length > 0 ? 'ok' : base.status;
      return {
        status,
        query: base.query,
        items: merged,
      };
    } catch {
      // Non-fatal: TRO ingestion augmentation must not break hazard delivery.
      return base;
    }
  }

  private async loadCouncilTroFeatures(input: BboxInput): Promise<RoadHazardItem[]> {
    if (!(await this.isCouncilTroTableAvailable())) {
      return [];
    }

    const centerLat = (input.south + input.north) / 2;
    const centerLon = (input.west + input.east) / 2;
    const troLimit = Math.max(60, Math.min(800, input.limit * 4));

    const rows = await this.dataSource.query<TroFeatureRow[]>(
      `
      SELECT
        t.id,
        t.hazard_type,
        ST_Y(t.feature_point) AS lat,
        ST_X(t.feature_point) AS lon,
        t.priority,
        t.confidence,
        COALESCE(t.label, t.source_name, t.authority_name, 'Council TRO') AS label,
        ST_Distance(
          t.feature_point::geography,
          ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography
        ) AS dist_m
      FROM council_tro_features t
      WHERE t.is_active = TRUE
        AND (t.valid_from IS NULL OR t.valid_from <= now())
        AND (t.valid_to IS NULL OR t.valid_to >= now())
        AND (t.expires_at IS NULL OR t.expires_at > now())
        AND ST_Intersects(
          t.geom,
          ST_MakeEnvelope($1, $2, $3, $4, 4326)
        )
        AND ($7::text[] IS NULL OR t.hazard_type = ANY($7))
      ORDER BY COALESCE(t.priority, 0) DESC, dist_m ASC
      LIMIT $8
      `,
      [
        input.west,
        input.south,
        input.east,
        input.north,
        centerLon,
        centerLat,
        input.types,
        troLimit,
      ],
    );

    return rows
      .map((row) => this.mapTroRowToRoadHazardItem(row))
      .filter((item): item is RoadHazardItem => item != null);
  }

  private async isCouncilTroTableAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.troTableAvailable != null && now - this.troTableCheckedAtMs < 60_000) {
      return this.troTableAvailable;
    }

    try {
      const rows = await this.dataSource.query<Array<{ regclass: string | null }>>(
        `SELECT to_regclass('public.council_tro_features')::text AS regclass`,
      );
      this.troTableAvailable = Boolean(rows?.[0]?.regclass);
    } catch {
      this.troTableAvailable = false;
    }
    this.troTableCheckedAtMs = now;
    return this.troTableAvailable;
  }

  private mapTroRowToRoadHazardItem(row: TroFeatureRow): RoadHazardItem | null {
    const type = String(row.hazard_type || '') as RoadHazardType;
    if (!this.isAllowedHazardType(type)) return null;

    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const priority = Number(row.priority);
    const confidence = Number(row.confidence);
    const distM = Number(row.dist_m);

    const item: RoadHazardItem = {
      id: `tro:${row.id}`,
      type,
      lat,
      lon,
      priority: Number.isFinite(priority) ? priority : this.priorityForType(type),
      source: 'council_tro',
      confidence: Number.isFinite(confidence)
        ? confidence
        : this.confidenceForType(type),
      labels: { primary: row.label ?? 'Council TRO' },
    };

    if (Number.isFinite(distM)) {
      item.distM = Math.round(distM);
    }

    return item;
  }

  private mergeTroItems(baseItems: RoadHazardItem[], troItems: RoadHazardItem[]): RoadHazardItem[] {
    const merged = [...baseItems];
    for (const tro of troItems) {
      for (let i = merged.length - 1; i >= 0; i -= 1) {
        const existing = merged[i];
        if (existing.type !== tro.type) continue;
        if (existing.source === 'council_tro') continue;
        const distanceM = this.haversineMeters(
          existing.lat,
          existing.lon,
          tro.lat,
          tro.lon,
        );
        if (distanceM <= 20) {
          merged.splice(i, 1);
        }
      }
      merged.push(tro);
    }

    return merged.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return (a.distM ?? 0) - (b.distM ?? 0);
    });
  }

  private async persistCacheRow(input: {
    queryKey: string;
    input: BboxInput;
    status: OsmSourceStatus;
    features: AdvisoryFeature[];
    snapshot: string | null;
  }): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.cacheTtlHours * 60 * 60 * 1000);
    const centerLat = (input.input.south + input.input.north) / 2;
    const centerLon = (input.input.west + input.input.east) / 2;
    const metadata = {
      schema: QUERY_SCHEMA_VERSION,
      requestedTypes: input.input.types ?? [],
    };

    await this.dataSource.query('BEGIN');
    try {
      const upsertQuery = await this.dataSource.query<{ id: string }[]>(
        `
        INSERT INTO advisory_query_cache (
          query_key, south, west, north, east, corridor_m, types,
          source_status, fetched_at, expires_at, overpass_snapshot, metadata, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9, $10, $11::jsonb, now())
        ON CONFLICT (query_key)
        DO UPDATE SET
          south = EXCLUDED.south,
          west = EXCLUDED.west,
          north = EXCLUDED.north,
          east = EXCLUDED.east,
          corridor_m = EXCLUDED.corridor_m,
          types = EXCLUDED.types,
          source_status = EXCLUDED.source_status,
          fetched_at = now(),
          expires_at = EXCLUDED.expires_at,
          overpass_snapshot = EXCLUDED.overpass_snapshot,
          metadata = EXCLUDED.metadata,
          updated_at = now()
        RETURNING id
        `,
        [
          input.queryKey,
          input.input.south,
          input.input.west,
          input.input.north,
          input.input.east,
          input.input.corridorM,
          input.input.types,
          input.status,
          expiresAt.toISOString(),
          input.snapshot,
          JSON.stringify(metadata),
        ],
      );

      const queryId = upsertQuery?.[0]?.id;
      if (!queryId) {
        throw new Error(`Failed to upsert advisory cache query ${input.queryKey}`);
      }

      await this.dataSource.query(
        `DELETE FROM advisory_query_features WHERE query_id = $1`,
        [queryId],
      );

      for (const feature of input.features) {
        await this.dataSource.query(
          `
          INSERT INTO advisory_features (
            id, osm_type, osm_id, hazard_type, lat, lon, geom, priority, confidence,
            label, sign_title, sign_code, sign_image_path, source, raw_tags,
            fetched_at, expires_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography,
            $7, $8, $9, $10, $11, $12, $13, $14::jsonb,
            $15, $16, now()
          )
          ON CONFLICT (id)
          DO UPDATE SET
            osm_type = EXCLUDED.osm_type,
            osm_id = EXCLUDED.osm_id,
            hazard_type = EXCLUDED.hazard_type,
            lat = EXCLUDED.lat,
            lon = EXCLUDED.lon,
            geom = EXCLUDED.geom,
            priority = EXCLUDED.priority,
            confidence = EXCLUDED.confidence,
            label = EXCLUDED.label,
            sign_title = EXCLUDED.sign_title,
            sign_code = EXCLUDED.sign_code,
            sign_image_path = EXCLUDED.sign_image_path,
            source = EXCLUDED.source,
            raw_tags = EXCLUDED.raw_tags,
            fetched_at = EXCLUDED.fetched_at,
            expires_at = EXCLUDED.expires_at,
            updated_at = now()
          `,
          [
            feature.id,
            feature.osmType,
            feature.osmId,
            feature.hazardType,
            feature.lat,
            feature.lon,
            feature.priority,
            feature.confidence,
            feature.label,
            feature.signTitle,
            feature.signCode,
            feature.signImagePath,
            feature.source,
            JSON.stringify(feature.rawTags ?? {}),
            now.toISOString(),
            expiresAt.toISOString(),
          ],
        );

        const distM = this.haversineMeters(
          centerLat,
          centerLon,
          feature.lat,
          feature.lon,
        );
        await this.dataSource.query(
          `
          INSERT INTO advisory_query_features (query_id, feature_id, dist_m)
          VALUES ($1, $2, $3)
          ON CONFLICT (query_id, feature_id)
          DO UPDATE SET dist_m = EXCLUDED.dist_m
          `,
          [queryId, feature.id, Number.isFinite(distM) ? distM : null],
        );
      }

      await this.dataSource.query('COMMIT');
    } catch (error) {
      await this.dataSource.query('ROLLBACK');
      throw error;
    }
  }

  private async fetchOverpass(input: BboxInput): Promise<{
    snapshot: string | null;
    items: AdvisoryFeature[];
  }> {
    const query = this.buildOverpassUnionQuery(
      input.south,
      input.west,
      input.north,
      input.east,
      input.types,
    );
    const body = `data=${this.percentEncodeForForm(query)}`;

    let responsePayload: OverpassResponse | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(this.overpassEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
            'User-Agent': 'Drivest-Backend/1.0 (+https://drivest.uk)',
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) {
          if ((response.status === 429 || response.status === 504) && attempt < 3) {
            await this.sleep(500 * attempt);
            continue;
          }
          throw new Error(`Overpass returned HTTP ${response.status}`);
        }

        responsePayload = (await response.json()) as OverpassResponse;
        break;
      } catch (error) {
        clearTimeout(timer);
        lastError = error as Error;
        if (attempt < 3) {
          await this.sleep(450 * attempt);
          continue;
        }
      }
    }

    if (!responsePayload) {
      throw lastError ?? new Error('Overpass request failed');
    }

    const features = this.mapOverpassElements(
      responsePayload.elements ?? [],
      input.types,
    );

    return {
      snapshot: responsePayload.osm3s?.timestamp_osm_base ?? null,
      items: features,
    };
  }

  private mapOverpassElements(
    elements: OverpassElement[],
    requestedTypes: RoadHazardType[] | null,
  ): AdvisoryFeature[] {
    const requested = requestedTypes ? new Set<RoadHazardType>(requestedTypes) : null;
    const byId = new Map<string, AdvisoryFeature>();

    for (const element of elements ?? []) {
      const rawId = Number(element.id);
      if (!Number.isFinite(rawId)) continue;
      const osmType = String(element.type ?? '').toLowerCase();
      if (!osmType) continue;

      const lat = this.resolveElementLat(element);
      const lon = this.resolveElementLon(element);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const tags = this.normalizeTags(element.tags);
      const hazardTypes = this.resolveHazardTypes(tags);
      if (!hazardTypes.length) continue;

      for (const hazardType of hazardTypes) {
        if (requested && !requested.has(hazardType)) continue;
        const featureId = `osm:${osmType}:${Math.trunc(rawId)}:${hazardType}`;
        const [priority, confidence] = [
          this.priorityForType(hazardType),
          this.confidenceForType(hazardType),
        ];
        const [signTitle, signCode, signImagePath] = this.signMetadataForType(
          hazardType,
          tags,
        );

        const feature: AdvisoryFeature = {
          id: featureId,
          osmType,
          osmId: Math.trunc(rawId),
          hazardType,
          lat,
          lon,
          priority,
          confidence,
          label: this.bestLabelForType(hazardType, tags),
          signTitle,
          signCode,
          signImagePath,
          source: 'osm_overpass',
          rawTags: tags,
        };

        const existing = byId.get(featureId);
        if (!existing || this.isBetterFeature(feature, existing)) {
          byId.set(featureId, feature);
        }
      }
    }

    return [...byId.values()].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.hazardType !== b.hazardType) {
        return a.hazardType.localeCompare(b.hazardType);
      }
      if (a.lat !== b.lat) return a.lat - b.lat;
      return a.lon - b.lon;
    });
  }

  private resolveHazardTypes(tags: Record<string, string>): RoadHazardType[] {
    if (!tags || Object.keys(tags).length === 0) return [];
    const tokens = this.trafficSignTokens(tags);
    const types = new Set<RoadHazardType>();

    if (
      tags.highway === 'traffic_signals' ||
      tokens.some((token) => token.includes('traffic_signals') || token.includes('signal'))
    ) {
      types.add('traffic_light');
    }

    const isZebra =
      tags.crossing === 'zebra' ||
      tags.crossing_ref === 'zebra' ||
      tags['crossing:markings'] === 'zebra' ||
      (tags.highway === 'crossing' &&
        (tags.crossing === 'zebra' || tags.crossing_ref === 'zebra')) ||
      tokens.some((token) => token.includes('zebra') || token.includes('pedestrian_crossing'));
    if (isZebra) {
      types.add('zebra_crossing');
    }

    const isGiveWay =
      tags.highway === 'give_way' ||
      tags.give_way === 'yes' ||
      tokens.some(
        (token) =>
          token.includes('give_way') ||
          token.includes('give way') ||
          token.includes('yield'),
      );
    if (isGiveWay) {
      types.add('give_way');
    }

    const isSpeedCamera =
      tags.highway === 'speed_camera' ||
      tags.enforcement === 'speed_camera' ||
      tags.speed_camera === 'yes' ||
      tags['camera:speed'] === 'yes';
    if (isSpeedCamera) {
      types.add('speed_camera');
    }

    const isMiniRoundabout =
      tags.highway === 'mini_roundabout' ||
      tags.junction === 'mini_roundabout' ||
      tags.mini_roundabout === 'yes' ||
      tokens.some((token) => token.includes('mini_roundabout'));
    if (isMiniRoundabout) {
      types.add('mini_roundabout');
    } else if (
      tags.junction === 'roundabout' ||
      tokens.some((token) => token.includes('roundabout'))
    ) {
      types.add('roundabout');
    }

    if (
      tags.amenity === 'school' ||
      tags.landuse === 'school' ||
      tags.hazard === 'school_zone' ||
      tags.hazard === 'children' ||
      tags['zone:traffic'] === 'school' ||
      tags['maxspeed:type'] === 'school_zone' ||
      tokens.some((token) => token.includes('school'))
    ) {
      types.add('school_warning');
    }

    const busLaneKey = Object.keys(tags).some(
      (key) =>
        key === 'bus:lanes' ||
        key === 'lanes:bus' ||
        key === 'busway' ||
        key === 'busway:left' ||
        key === 'busway:right',
    );
    if (busLaneKey) {
      types.add('bus_lane');
    }

    const isBusStop =
      tags.highway === 'bus_stop' ||
      (tags.public_transport === 'stop_position' &&
        (tags.bus === 'yes' || tags.bus === 'designated')) ||
      (tags.public_transport === 'platform' &&
        (tags.bus === 'yes' || tags.highway === 'bus_stop')) ||
      tokens.some((token) => token.includes('bus_stop') || token.includes('bus stop'));
    if (isBusStop) {
      types.add('bus_stop');
    }

    if (this.hasNoEntryTrafficSign(tags)) {
      // Existing API contract maps NO_ENTRY via stop_sign type.
      types.add('stop_sign');
    }

    if (types.size === 0 && tokens.length > 0) {
      types.add('hazard_generic');
    }

    return [...types];
  }

  private hasNoEntryTrafficSign(tags: Record<string, string>): boolean {
    const values = [
      tags.traffic_sign,
      tags['traffic_sign:forward'],
      tags['traffic_sign:backward'],
      tags['traffic_sign:both'],
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    return values.some((value) => {
      return (
        value.includes('no_entry') ||
        value.includes('no entry') ||
        value.includes('gb:616') ||
        value.includes('gb_616')
      );
    });
  }

  private trafficSignTokens(tags: Record<string, string>): string[] {
    const rawValues = [
      tags.traffic_sign,
      tags['traffic_sign:forward'],
      tags['traffic_sign:backward'],
      tags['traffic_sign:both'],
    ].filter((value): value is string => Boolean(value));

    return rawValues
      .flatMap((value) =>
        value.split(/[;,|]/g).map((token) => token.trim().toLowerCase()),
      )
      .filter(Boolean)
      .map((token) => token.replace(/:/g, '_'));
  }

  private signMetadataForType(
    type: RoadHazardType,
    tags: Record<string, string>,
  ): MetadataTuple {
    switch (type) {
      case 'traffic_light':
        return ['Traffic signals ahead', '543', 'warning-signs-jpg/543.jpg'];
      case 'zebra_crossing':
        return ['Zebra crossing ahead', '544', 'warning-signs-jpg/544.jpg'];
      case 'roundabout':
        return ['Roundabout', '611', 'regulatory-signs-jpg/611.jpg'];
      case 'mini_roundabout':
        return ['Mini roundabout', '611.1', 'regulatory-signs-jpg/611.1.jpg'];
      case 'bus_lane':
        return ['Bus lane', '958', 'bus-and-cycle-signs-jpg/958.jpg'];
      case 'bus_stop':
        return ['Bus stop', '975', 'bus-and-cycle-signs-jpg/975.jpg'];
      case 'give_way':
        return ['Give way', '602', 'regulatory-signs-jpg/602.jpg'];
      case 'school_warning':
        return ['School warning', '545', 'warning-signs-jpg/545.jpg'];
      case 'stop_sign':
        return ['No entry', '616', 'regulatory-signs-jpg/616.jpg'];
      case 'speed_camera':
        return ['Speed camera', '880', 'speed-limit-signs-jpg/880.jpg'];
      case 'hazard_generic': {
        const token = this.trafficSignTokens(tags)[0] ?? null;
        if (!token) return [null, null, null];
        const title = token
          .replace(/_/g, ' ')
          .trim()
          .replace(/\b\w/g, (m) => m.toUpperCase());
        return [title || null, token, null];
      }
      default:
        return [null, null, null];
    }
  }

  private bestLabelForType(
    type: RoadHazardType,
    tags: Record<string, string>,
  ): string | null {
    if (tags.name) return tags.name;
    switch (type) {
      case 'traffic_light':
        return 'Traffic lights';
      case 'zebra_crossing':
        return 'Zebra crossing';
      case 'roundabout':
        return 'Roundabout';
      case 'mini_roundabout':
        return 'Mini roundabout';
      case 'bus_lane':
        return 'Bus lane';
      case 'bus_stop':
        return 'Bus stop';
      case 'give_way':
        return 'Give way';
      case 'school_warning':
        return 'School warning';
      case 'stop_sign':
        return 'No entry';
      case 'speed_camera':
        return 'Speed camera';
      default:
        return null;
    }
  }

  private isBetterFeature(candidate: AdvisoryFeature, existing: AdvisoryFeature): boolean {
    if (candidate.priority !== existing.priority) {
      return candidate.priority > existing.priority;
    }
    if (candidate.confidence !== existing.confidence) {
      return candidate.confidence > existing.confidence;
    }
    return Object.keys(candidate.rawTags).length > Object.keys(existing.rawTags).length;
  }

  private buildOverpassUnionQuery(
    south: number,
    west: number,
    north: number,
    east: number,
    types: RoadHazardType[] | null,
  ): string {
    const selected = types?.length ? types : [...ROAD_HAZARD_TYPES];
    const clauses = selected
      .filter((type, idx, arr) => arr.indexOf(type) === idx)
      .map((type) => this.overpassClauses(type, south, west, north, east))
      .filter(Boolean)
      .join('\n');

    return `
[out:json][timeout:20];
(
${clauses}
);
out body center;
`.trim();
  }

  private overpassClauses(
    type: RoadHazardType,
    south: number,
    west: number,
    north: number,
    east: number,
  ): string {
    switch (type) {
      case 'traffic_light':
        return `
node["highway"="traffic_signals"](${south},${west},${north},${east});
way["highway"="traffic_signals"](${south},${west},${north},${east});
`;
      case 'zebra_crossing':
        return `
node["crossing"="zebra"](${south},${west},${north},${east});
way["crossing"="zebra"](${south},${west},${north},${east});
node["crossing_ref"="zebra"](${south},${west},${north},${east});
way["crossing_ref"="zebra"](${south},${west},${north},${east});
node["highway"="crossing"]["crossing"="zebra"](${south},${west},${north},${east});
way["highway"="crossing"]["crossing"="zebra"](${south},${west},${north},${east});
`;
      case 'give_way':
        return `
node["highway"="give_way"](${south},${west},${north},${east});
way["highway"="give_way"](${south},${west},${north},${east});
node["give_way"="yes"](${south},${west},${north},${east});
way["give_way"="yes"](${south},${west},${north},${east});
node["traffic_sign"~"give[_ ]?way|yield",i](${south},${west},${north},${east});
way["traffic_sign"~"give[_ ]?way|yield",i](${south},${west},${north},${east});
`;
      case 'speed_camera':
        return `
node["highway"="speed_camera"](${south},${west},${north},${east});
way["highway"="speed_camera"](${south},${west},${north},${east});
node["enforcement"="speed_camera"](${south},${west},${north},${east});
way["enforcement"="speed_camera"](${south},${west},${north},${east});
node["camera:speed"="yes"](${south},${west},${north},${east});
way["camera:speed"="yes"](${south},${west},${north},${east});
`;
      case 'roundabout':
        return `
node["junction"="roundabout"](${south},${west},${north},${east});
way["junction"="roundabout"](${south},${west},${north},${east});
`;
      case 'mini_roundabout':
        return `
node["highway"="mini_roundabout"](${south},${west},${north},${east});
way["highway"="mini_roundabout"](${south},${west},${north},${east});
node["junction"="mini_roundabout"](${south},${west},${north},${east});
way["junction"="mini_roundabout"](${south},${west},${north},${east});
`;
      case 'school_warning':
        return `
node["amenity"="school"](${south},${west},${north},${east});
way["amenity"="school"](${south},${west},${north},${east});
node["landuse"="school"](${south},${west},${north},${east});
way["landuse"="school"](${south},${west},${north},${east});
node["hazard"~"school_zone|children",i](${south},${west},${north},${east});
way["hazard"~"school_zone|children",i](${south},${west},${north},${east});
`;
      case 'bus_lane':
        return `
node["bus:lanes"](${south},${west},${north},${east});
way["bus:lanes"](${south},${west},${north},${east});
node["lanes:bus"](${south},${west},${north},${east});
way["lanes:bus"](${south},${west},${north},${east});
node["busway"](${south},${west},${north},${east});
way["busway"](${south},${west},${north},${east});
node["busway:left"](${south},${west},${north},${east});
way["busway:left"](${south},${west},${north},${east});
node["busway:right"](${south},${west},${north},${east});
way["busway:right"](${south},${west},${north},${east});
`;
      case 'bus_stop':
        return `
node["highway"="bus_stop"](${south},${west},${north},${east});
way["highway"="bus_stop"](${south},${west},${north},${east});
node["public_transport"="stop_position"]["bus"="yes"](${south},${west},${north},${east});
way["public_transport"="stop_position"]["bus"="yes"](${south},${west},${north},${east});
node["public_transport"="platform"]["bus"="yes"](${south},${west},${north},${east});
way["public_transport"="platform"]["bus"="yes"](${south},${west},${north},${east});
`;
      case 'stop_sign':
        return `
node["traffic_sign"~"no[_ ]?entry|GB:616",i](${south},${west},${north},${east});
way["traffic_sign"~"no[_ ]?entry|GB:616",i](${south},${west},${north},${east});
node["traffic_sign:forward"~"no[_ ]?entry|GB:616",i](${south},${west},${north},${east});
way["traffic_sign:forward"~"no[_ ]?entry|GB:616",i](${south},${west},${north},${east});
node["traffic_sign:backward"~"no[_ ]?entry|GB:616",i](${south},${west},${north},${east});
way["traffic_sign:backward"~"no[_ ]?entry|GB:616",i](${south},${west},${north},${east});
node["no_entry"="yes"](${south},${west},${north},${east});
way["no_entry"="yes"](${south},${west},${north},${east});
`;
      case 'hazard_generic':
        return `
node["traffic_sign"](${south},${west},${north},${east});
way["traffic_sign"](${south},${west},${north},${east});
node["highway"="crossing"](${south},${west},${north},${east});
way["highway"="crossing"](${south},${west},${north},${east});
`;
      default:
        return '';
    }
  }

  private normalizeTags(
    rawTags: Record<string, unknown> | undefined,
  ): Record<string, string> {
    if (!rawTags || typeof rawTags !== 'object') {
      return {};
    }

    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawTags)) {
      if (value == null) continue;
      const normalizedKey = String(key).trim().toLowerCase();
      if (!normalizedKey) continue;
      normalized[normalizedKey] = String(value)
        .trim()
        .toLowerCase();
    }
    return normalized;
  }

  private resolveElementLat(element: OverpassElement): number {
    if (Number.isFinite(element.lat)) return Number(element.lat);
    if (Number.isFinite(element.center?.lat)) return Number(element.center?.lat);
    return Number.NaN;
  }

  private resolveElementLon(element: OverpassElement): number {
    if (Number.isFinite(element.lon)) return Number(element.lon);
    if (Number.isFinite(element.center?.lon)) return Number(element.center?.lon);
    return Number.NaN;
  }

  private normalizeCoordinates(
    rawCoordinates: any,
    rawGeojson?: any,
  ): Array<[number, number]> {
    const fromCoordinates = this.fromCoordinates(rawCoordinates);
    if (fromCoordinates.length >= 2) {
      return this.dedupeCoordinates(fromCoordinates);
    }
    const fromGeojson = this.fromGeojson(rawGeojson);
    if (fromGeojson.length >= 2) {
      return this.dedupeCoordinates(fromGeojson);
    }
    return [];
  }

  private fromCoordinates(rawCoordinates: any): Array<[number, number]> {
    let payload = rawCoordinates;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(payload)) return [];

    const mapped: Array<[number, number]> = [];
    for (const point of payload) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const lon = Number(point[0]);
      const lat = Number(point[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
      mapped.push([Number(lon.toFixed(6)), Number(lat.toFixed(6))]);
    }
    return mapped;
  }

  private fromGeojson(rawGeojson: any): Array<[number, number]> {
    if (!rawGeojson) return [];
    let payload = rawGeojson;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return [];
      }
    }

    const coordinates = Array.isArray(payload?.coordinates)
      ? payload.coordinates
      : Array.isArray(payload)
        ? payload
        : null;
    if (!Array.isArray(coordinates)) return [];

    const mapped: Array<[number, number]> = [];
    for (const point of coordinates) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const lon = Number(point[0]);
      const lat = Number(point[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
      mapped.push([Number(lon.toFixed(6)), Number(lat.toFixed(6))]);
    }
    return mapped;
  }

  private dedupeCoordinates(
    coords: Array<[number, number]>,
  ): Array<[number, number]> {
    const deduped: Array<[number, number]> = [];
    let prev: [number, number] | null = null;
    for (const [lon, lat] of coords) {
      if (!prev || prev[0] !== lon || prev[1] !== lat) {
        deduped.push([lon, lat]);
        prev = [lon, lat];
      }
    }
    return deduped;
  }

  private computeExpandedBbox(
    routeCoordinates: Array<[number, number]>,
    radiusMeters: number,
  ): {
    south: number;
    west: number;
    north: number;
    east: number;
  } {
    let south = Number.POSITIVE_INFINITY;
    let west = Number.POSITIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let latTotal = 0;

    for (const [lon, lat] of routeCoordinates) {
      if (lat < south) south = lat;
      if (lon < west) west = lon;
      if (lat > north) north = lat;
      if (lon > east) east = lon;
      latTotal += lat;
    }

    const meanLat = latTotal / routeCoordinates.length;
    const latDelta = radiusMeters / 111_320;
    const lonMetersPerDegree = Math.max(
      Math.abs(111_320 * Math.cos((meanLat * Math.PI) / 180)),
      10_000,
    );
    const lonDelta = radiusMeters / lonMetersPerDegree;
    return {
      south: Number((south - latDelta).toFixed(6)),
      west: Number((west - lonDelta).toFixed(6)),
      north: Number((north + latDelta).toFixed(6)),
      east: Number((east + lonDelta).toFixed(6)),
    };
  }

  private computeRadiusBbox(
    lat: number,
    lon: number,
    radiusMeters: number,
  ): {
    south: number;
    west: number;
    north: number;
    east: number;
  } {
    const latDelta = radiusMeters / 111_320;
    const lonMetersPerDegree = Math.max(
      Math.abs(111_320 * Math.cos((lat * Math.PI) / 180)),
      10_000,
    );
    const lonDelta = radiusMeters / lonMetersPerDegree;
    return {
      south: Number((lat - latDelta).toFixed(6)),
      west: Number((lon - lonDelta).toFixed(6)),
      north: Number((lat + latDelta).toFixed(6)),
      east: Number((lon + lonDelta).toFixed(6)),
    };
  }

  private minimumDistanceToRouteMeters(
    point: { lat: number; lon: number },
    route: Array<[number, number]>,
  ): number {
    if (route.length < 2) return Number.POSITIVE_INFINITY;
    let minDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < route.length - 1; i += 1) {
      const a = route[i];
      const b = route[i + 1];
      const distance = this.pointToSegmentDistanceMeters(point, a, b);
      if (distance < minDistance) minDistance = distance;
    }
    return minDistance;
  }

  private pointToSegmentDistanceMeters(
    point: { lat: number; lon: number },
    a: [number, number],
    b: [number, number],
  ): number {
    const referenceLat = (point.lat * Math.PI) / 180;
    const metersPerDegLat = 111_320;
    const metersPerDegLon = Math.cos(referenceLat) * 111_320;

    const px = (point.lon - a[0]) * metersPerDegLon;
    const py = (point.lat - a[1]) * metersPerDegLat;
    const ex = (b[0] - a[0]) * metersPerDegLon;
    const ey = (b[1] - a[1]) * metersPerDegLat;

    const len2 = ex * ex + ey * ey;
    if (len2 <= 1e-6) return Math.hypot(px, py);
    const t = Math.max(0, Math.min(1, (px * ex + py * ey) / len2));
    const projX = t * ex;
    const projY = t * ey;
    return Math.hypot(px - projX, py - projY);
  }

  private routeLengthMeters(route: Array<[number, number]>): number {
    if (route.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < route.length - 1; i += 1) {
      total += this.haversineMeters(route[i][1], route[i][0], route[i + 1][1], route[i + 1][0]);
    }
    return total;
  }

  private projectOntoRouteMeters(
    point: { lat: number; lon: number },
    route: Array<[number, number]>,
  ): { progressM: number; offRouteM: number } {
    if (route.length < 2) return { progressM: 0, offRouteM: Number.POSITIVE_INFINITY };

    let bestProgress = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    let traversed = 0;

    for (let i = 0; i < route.length - 1; i += 1) {
      const a = route[i];
      const b = route[i + 1];
      const segmentLength = this.haversineMeters(a[1], a[0], b[1], b[0]);

      const projection = this.projectToSegment(point, a, b);
      const progress = traversed + projection.t * segmentLength;
      if (projection.distanceM < bestDistance) {
        bestDistance = projection.distanceM;
        bestProgress = progress;
      }

      traversed += segmentLength;
    }

    return { progressM: bestProgress, offRouteM: bestDistance };
  }

  private projectToSegment(
    point: { lat: number; lon: number },
    a: [number, number],
    b: [number, number],
  ): { t: number; distanceM: number } {
    const referenceLat = (point.lat * Math.PI) / 180;
    const metersPerDegLat = 111_320;
    const metersPerDegLon = Math.cos(referenceLat) * 111_320;

    const px = (point.lon - a[0]) * metersPerDegLon;
    const py = (point.lat - a[1]) * metersPerDegLat;
    const ex = (b[0] - a[0]) * metersPerDegLon;
    const ey = (b[1] - a[1]) * metersPerDegLat;
    const len2 = ex * ex + ey * ey;
    if (len2 <= 1e-6) {
      return { t: 0, distanceM: Math.hypot(px, py) };
    }

    const t = Math.max(0, Math.min(1, (px * ex + py * ey) / len2));
    const projX = t * ex;
    const projY = t * ey;
    return { t, distanceM: Math.hypot(px - projX, py - projY) };
  }

  private buildQueryKey(input: BboxInput): string {
    const payload = {
      schema: QUERY_SCHEMA_VERSION,
      south: Number(input.south.toFixed(6)),
      west: Number(input.west.toFixed(6)),
      north: Number(input.north.toFixed(6)),
      east: Number(input.east.toFixed(6)),
      corridorM: Math.round(input.corridorM),
      types: input.types ? [...input.types].sort() : null,
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private toSourceStatus(value: string): OsmSourceStatus {
    if (value === 'ok') return 'ok';
    if (value === 'no_route_geometry') return 'no_route_geometry';
    return 'osm_unavailable';
  }

  private normalizeTypes(
    types?: RoadHazardType[] | string[] | null,
  ): RoadHazardType[] | null {
    if (!Array.isArray(types) || types.length === 0) return null;
    const allowed = new Set<RoadHazardType>(ROAD_HAZARD_TYPES);
    const normalized = [...new Set(types.map((value) => String(value).trim()))]
      .map((value) => value as RoadHazardType)
      .filter((value) => allowed.has(value));
    return normalized.length ? normalized : null;
  }

  private isAllowedHazardType(value: string): value is RoadHazardType {
    return (ROAD_HAZARD_TYPES as readonly string[]).includes(value);
  }

  private priorityForType(type: RoadHazardType): number {
    switch (type) {
      case 'school_warning':
        return 92;
      case 'roundabout':
        return 88;
      case 'mini_roundabout':
        return 86;
      case 'zebra_crossing':
        return 85;
      case 'traffic_light':
        return 80;
      case 'stop_sign':
        return 78;
      case 'give_way':
        return 74;
      case 'speed_camera':
        return 73;
      case 'bus_lane':
        return 72;
      case 'bus_stop':
        return 66;
      case 'hazard_generic':
      default:
        return 50;
    }
  }

  private confidenceForType(type: RoadHazardType): number {
    switch (type) {
      case 'traffic_light':
        return 0.9;
      case 'zebra_crossing':
        return 0.85;
      case 'roundabout':
        return 0.88;
      case 'mini_roundabout':
        return 0.86;
      case 'give_way':
        return 0.9;
      case 'stop_sign':
        return 0.92;
      case 'speed_camera':
        return 0.85;
      case 'bus_lane':
        return 0.78;
      case 'bus_stop':
        return 0.72;
      case 'school_warning':
        return 0.72;
      case 'hazard_generic':
      default:
        return 0.5;
    }
  }

  private percentEncodeForForm(raw: string): string {
    return encodeURIComponent(raw).replace(/%20/g, '+');
  }

  private toIsoStringOrNull(value: Date | string | null): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const radius = 6_371_000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radius * c;
  }

  private async insertFetchRun(input: {
    queryKey: string;
    cacheHit: boolean;
    status: string;
    durationMs: number;
    fetchedCount: number;
    error?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.dataSource.query(
        `
        INSERT INTO advisory_fetch_runs (
          query_key, cache_hit, status, duration_ms, fetched_count, error, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        `,
        [
          input.queryKey,
          input.cacheHit,
          input.status,
          Math.max(0, Math.round(input.durationMs)),
          Math.max(0, Math.round(input.fetchedCount)),
          input.error ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
    } catch {
      // Intentionally non-fatal: fetch run logging must not break advisory delivery.
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  private clampInt(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  private envBool(key: string, fallback: boolean): boolean {
    const raw = process.env[key];
    if (raw == null || raw === '') return fallback;
    const value = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(value)) return true;
    if (['0', 'false', 'no', 'off'].includes(value)) return false;
    return fallback;
  }
}
