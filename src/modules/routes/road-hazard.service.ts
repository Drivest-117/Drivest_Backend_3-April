import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { LruTtlCache } from './lru-ttl-cache';

export type RoadHazardType =
  | 'traffic_light'
  | 'zebra_crossing'
  | 'roundabout'
  | 'mini_roundabout'
  | 'bus_stop'
  | 'stop_sign'
  | 'give_way'
  | 'school_warning'
  | 'hazard_generic';

export const ROAD_HAZARD_TYPES: ReadonlyArray<RoadHazardType> = [
  'traffic_light',
  'zebra_crossing',
  'roundabout',
  'mini_roundabout',
  'bus_stop',
  'stop_sign',
  'give_way',
  'school_warning',
  'hazard_generic',
] as const;

export type OsmSourceStatus = 'ok' | 'osm_unavailable' | 'no_route_geometry';

export type RoadHazardItem = {
  id: string;
  type: RoadHazardType;
  lat: number;
  lon: number;
  priority: number;
  source: 'osm';
  confidence: number;
  labels?: {
    primary?: string | null;
  };
  distM?: number;
  aheadDistM?: number;
};

export type RouteHazardsV1 = {
  version: 'road_hazards_v1';
  generatedAt: string;
  corridorWidthM: number;
  routeHash: string;
  osmSnapshot: string | null;
  source_status: OsmSourceStatus;
  items: RoadHazardItem[];
};

export type NearbyHazardsResult = {
  source_status: OsmSourceStatus;
  radiusM: number;
  items: RoadHazardItem[];
};

type HazardQueryRow = {
  osm_id: string | number;
  source: string;
  osm_type: string;
  hazard_rule: HazardRuleKey;
  hazard_type: RoadHazardType;
  priority?: string | number;
  confidence?: string | number;
  label: string | null;
  lat: string | number;
  lon: string | number;
  dist_m: string | number;
  ahead_dist_m?: string | number | null;
};

type HazardRuleKey =
  | 'traffic_signals'
  | 'roundabout'
  | 'mini_roundabout'
  | 'bus_stop'
  | 'stop_sign'
  | 'give_way'
  | 'zebra_explicit'
  | 'crossing_generic'
  | 'school_hazard_tag'
  | 'school_zone_traffic'
  | 'school_amenity'
  | 'hazard_generic_tag';

type HazardRuleSpec = {
  type: RoadHazardType;
  priority: number;
  confidence: number;
};

const HAZARD_RULES: Readonly<Record<HazardRuleKey, HazardRuleSpec>> = {
  traffic_signals: { type: 'traffic_light', priority: 80, confidence: 0.9 },
  roundabout: { type: 'roundabout', priority: 88, confidence: 0.88 },
  mini_roundabout: { type: 'mini_roundabout', priority: 86, confidence: 0.86 },
  bus_stop: { type: 'bus_stop', priority: 66, confidence: 0.72 },
  stop_sign: { type: 'stop_sign', priority: 78, confidence: 0.9 },
  give_way: { type: 'give_way', priority: 74, confidence: 0.9 },
  zebra_explicit: { type: 'zebra_crossing', priority: 85, confidence: 0.85 },
  crossing_generic: { type: 'hazard_generic', priority: 50, confidence: 0.5 },
  school_hazard_tag: { type: 'school_warning', priority: 92, confidence: 0.75 },
  school_zone_traffic: { type: 'school_warning', priority: 90, confidence: 0.7 },
  school_amenity: { type: 'school_warning', priority: 86, confidence: 0.6 },
  hazard_generic_tag: { type: 'hazard_generic', priority: 50, confidence: 0.5 },
} as const;

type OsmAvailability = {
  ok: boolean;
  status: OsmSourceStatus;
  checkedAt: number;
  hasPointTable: boolean;
  hasLineTable: boolean;
  hasPolygonTable: boolean;
  hasHstore: boolean;
};

type OSMTableName =
  | 'planet_osm_point'
  | 'planet_osm_line'
  | 'planet_osm_polygon';

type HazardGeomColumns = {
  point: string;
  line: string | null;
  polygon: string | null;
};

const OSM_TABLE_WHITELIST: ReadonlySet<OSMTableName> = new Set<OSMTableName>([
  'planet_osm_point',
  'planet_osm_line',
  'planet_osm_polygon',
]);

@Injectable()
export class RoadHazardService {
  private osmReadyCache: OsmAvailability | null = null;
  private osmSridCache: number | null = null;
  private osmSridResolvePromise: Promise<number> | null = null;
  private readonly osmGeomColumnCache = new Map<OSMTableName, string | null>();
  private crsValidationLogged = false;

  private readonly hazardsEnabled = this.envBool('NAV_HAZARDS_ENABLED', true);
  private readonly debugLogs = this.envBool('NAV_HAZARDS_DEBUG', false);
  private readonly osmSnapshot = this.resolveOsmSnapshotFromEnv();
  private readonly nearbyCacheTtlMs = this.clampInt(
    Number(process.env.NAV_HAZARDS_NEARBY_CACHE_TTL_MS ?? 120000),
    0,
    3_600_000,
  );
  private readonly nearbyCacheMaxEntries = this.clampInt(
    Number(process.env.NAV_HAZARDS_NEARBY_CACHE_MAX_ENTRIES ?? 500),
    10,
    20000,
  );
  private readonly nearbyCache: LruTtlCache<NearbyHazardsResult>;
  private nearbyCacheHits = 0;
  private nearbyCacheMisses = 0;
  private nearbyCacheLookups = 0;

  constructor(private readonly dataSource: DataSource) {
    this.nearbyCache = new LruTtlCache<NearbyHazardsResult>(
      this.nearbyCacheMaxEntries,
      this.nearbyCacheTtlMs,
    );
  }

  normalizeCoordinates(rawCoordinates: any, rawGeojson?: any): Array<[number, number]> {
    const fromCoordinates = this.fromCoordinates(rawCoordinates);
    if (fromCoordinates.length >= 2) return this.dedupeCoordinates(fromCoordinates);

    const fromGeojson = this.fromGeojson(rawGeojson);
    if (fromGeojson.length >= 2) return this.dedupeCoordinates(fromGeojson);

    return [];
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
    const corridorWidthM = this.clamp(Number(options?.corridorWidthM ?? 45), 20, 200);
    const limit = this.clampInt(Number(options?.limit ?? 300), 1, 300);
    const types = this.normalizeTypes(options?.types);
    const coordinates = this.normalizeCoordinates(rawCoordinates, options?.rawGeojson);
    const routeHash = this.computeRouteHash(rawCoordinates, options?.rawGeojson);
    const osmSnapshot = this.osmSnapshot;

    if (coordinates.length < 2) {
      return {
        version: 'road_hazards_v1',
        generatedAt: new Date().toISOString(),
        corridorWidthM,
        routeHash,
        osmSnapshot,
        source_status: 'no_route_geometry',
        items: [],
      };
    }

    if (!this.hazardsEnabled) {
      return {
        version: 'road_hazards_v1',
        generatedAt: new Date().toISOString(),
        corridorWidthM,
        routeHash,
        osmSnapshot,
        source_status: 'osm_unavailable',
        items: [],
      };
    }

    const availability = await this.getOsmAvailability();
    if (!availability.ok) {
      return {
        version: 'road_hazards_v1',
        generatedAt: new Date().toISOString(),
        corridorWidthM,
        routeHash,
        osmSnapshot,
        source_status: availability.status,
        items: [],
      };
    }

    const geomColumns = await this.resolveHazardGeomColumns(availability);
    if (!geomColumns) {
      return {
        version: 'road_hazards_v1',
        generatedAt: new Date().toISOString(),
        corridorWidthM,
        routeHash,
        osmSnapshot,
        source_status: 'osm_unavailable',
        items: [],
      };
    }

    await this.ensureOsmSridResolved({
      planet_osm_point: geomColumns.point,
      planet_osm_line: geomColumns.line,
      planet_osm_polygon: geomColumns.polygon,
    });
    const osmSrid = this.resolveOsmSrid();
    this.validateCrsConfiguration(osmSrid);
    const routeLine = this.routeLineToOsmSrid(coordinates, osmSrid, '$1');

    const hazardsSql = this.buildRouteHazardsUnionSql(
      availability,
      osmSrid,
      geomColumns,
    );

    let rows: HazardQueryRow[] = [];
    try {
      rows = await this.dataSource.query(
        `
      WITH route_line AS (
        SELECT ${routeLine.sqlExpr} AS geom
      ),
      hazards AS (
        ${hazardsSql}
      ),
      deduped AS (
        SELECT DISTINCT ON (source, osm_type, hazard_type, osm_id)
          source,
          osm_type,
          osm_id,
          hazard_rule,
          hazard_type,
          priority,
          confidence,
          label,
          geom,
          dist_m
        FROM hazards
        WHERE ($3::text[] IS NULL OR hazard_type = ANY($3))
        ORDER BY source, osm_type, hazard_type, osm_id, dist_m ASC
      )
      SELECT
        source,
        osm_type,
        osm_id,
        hazard_rule,
        hazard_type,
        priority,
        confidence,
        label,
        ST_Y(ST_Transform(geom, 4326)) AS lat,
        ST_X(ST_Transform(geom, 4326)) AS lon,
        dist_m
      FROM deduped
      ORDER BY priority DESC, dist_m ASC
      LIMIT $4;
        `,
        [routeLine.geojson, corridorWidthM, types, limit],
      );
    } catch (error) {
      this.logDebug('route_query_failed', {
        message: (error as Error)?.message,
        corridorWidthM,
        limit,
      });
      return {
        version: 'road_hazards_v1',
        generatedAt: new Date().toISOString(),
        corridorWidthM,
        routeHash,
        osmSnapshot,
        source_status: 'osm_unavailable',
        items: [],
      };
    }

    const items = this.toItems(rows);

    this.logDebug('route_query_ok', {
      corridorWidthM,
      limit,
      types,
      count: items.length,
    });

    return {
      version: 'road_hazards_v1',
      generatedAt: new Date().toISOString(),
      corridorWidthM,
      routeHash,
      osmSnapshot,
      source_status: 'ok',
      items,
    };
  }

  computeRouteHash(rawCoordinates: any, rawGeojson?: any): string {
    const coordinates = this.normalizeCoordinates(rawCoordinates, rawGeojson);
    if (coordinates.length < 2) {
      return 'no_route_geometry';
    }

    const normalized = coordinates.map(([lon, lat]) => [
      Number(lon.toFixed(6)),
      Number(lat.toFixed(6)),
    ]);

    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
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
      mode === 'TO_START' ? 550 : mode === 'ON_ROUTE' ? 450 : 380;
    const radiusM = this.clamp(Number(params.radiusM ?? defaultRadius), 80, 1200);
    const limit = this.clampInt(Number(params.limit ?? 20), 1, 20);
    const routeCorridorM = this.clamp(Number(params.routeCorridorM ?? 120), 20, 500);
    const types = this.normalizeTypes(params.types);

    if (!this.hazardsEnabled) {
      return { source_status: 'osm_unavailable', radiusM, items: [] };
    }

    const availability = await this.getOsmAvailability();
    if (!availability.ok) {
      return { source_status: availability.status, radiusM, items: [] };
    }

    const geomColumns = await this.resolveHazardGeomColumns(availability);
    if (!geomColumns) {
      return { source_status: 'osm_unavailable', radiusM, items: [] };
    }

    await this.ensureOsmSridResolved({
      planet_osm_point: geomColumns.point,
      planet_osm_line: geomColumns.line,
      planet_osm_polygon: geomColumns.polygon,
    });
    const osmSrid = this.resolveOsmSrid();
    this.validateCrsConfiguration(osmSrid);

    const routeCoords = this.normalizeCoordinates(params.routeCoordinates);
    const routeLine =
      routeCoords.length >= 2
        ? this.routeLineToOsmSrid(routeCoords, osmSrid, '$3')
        : null;
    const routeGeom = routeLine?.geojson ?? null;
    const hasRouteContext = routeLine != null;
    const aheadOnly = hasRouteContext
      ? (params.aheadOnly ?? true)
      : false;
    const aheadDistanceM = this.clamp(
      Number(params.aheadDistanceM ?? 1200),
      50,
      10000,
    );
    const backtrackToleranceM = this.clamp(
      Number(params.backtrackToleranceM ?? 30),
      0,
      500,
    );
    const offRouteThresholdM = this.clamp(
      Number(process.env.NAV_HAZARDS_OFF_ROUTE_THRESHOLD_M ?? 120),
      20,
      1000,
    );

    const cacheKey = this.buildNearbyCacheKey({
      lat: params.lat,
      lon: params.lon,
      mode,
      radiusM,
      limit,
      routeCorridorM,
      types,
      routeId: params.routeId ?? null,
      routeCoords,
      aheadOnly,
      aheadDistanceM,
      backtrackToleranceM,
      offRouteThresholdM,
    });

    const cached = this.getNearbyFromCache(cacheKey);
    if (cached) {
      this.logDebug('nearby_cache_hit', {
        key: cacheKey,
        count: cached.items.length,
      });
      return cached;
    }

    const hazardsSql = this.buildNearbyHazardsUnionSql(
      availability,
      osmSrid,
      geomColumns,
    );
    const centerPointExpr = this.toOsmGeom(
      {
        lonExpr: '$1',
        latExpr: '$2',
      },
      osmSrid,
    );
    const routeLineExpr = routeLine?.sqlExpr ?? null;

    let rows: HazardQueryRow[] = [];
    try {
      rows = await this.dataSource.query(
        `
      WITH center_point AS (
        SELECT ${centerPointExpr} AS geom
      ),
      route_line AS (
        SELECT CASE
          WHEN $3::text IS NULL THEN NULL::geometry
          ELSE ${routeLineExpr ?? 'NULL::geometry'}
        END AS geom
      ),
      route_metrics AS (
        SELECT
          rl.geom AS route_geom,
          CASE
            WHEN rl.geom IS NULL THEN NULL::double precision
            ELSE ${this.metricLengthExpr('rl.geom', osmSrid)}
          END AS route_len_m,
          CASE
            WHEN rl.geom IS NULL THEN NULL::double precision
            ELSE ${this.sqlDistanceM('c.geom', 'ST_ClosestPoint(rl.geom, c.geom)')}
          END AS off_route_dist_m,
          CASE
            WHEN rl.geom IS NULL THEN NULL::boolean
            WHEN ${this.sqlDistanceM('c.geom', 'ST_ClosestPoint(rl.geom, c.geom)')} > GREATEST($12::double precision, $5::double precision * 2) THEN TRUE
            ELSE FALSE
          END AS is_off_route,
          CASE
            WHEN rl.geom IS NULL THEN NULL::double precision
            ELSE ST_LineLocatePoint(rl.geom, ST_ClosestPoint(rl.geom, c.geom))
          END AS route_progress,
          CASE
            WHEN rl.geom IS NULL OR ${this.metricLengthExpr('rl.geom', osmSrid)} <= 0 THEN NULL::double precision
            ELSE ($10::double precision / ${this.metricLengthExpr('rl.geom', osmSrid)})
          END AS tol_progress
        FROM route_line rl
        CROSS JOIN center_point c
      ),
      hazards AS (
        ${hazardsSql}
      ),
      scored AS (
        SELECT
          h.source,
          h.osm_type,
          h.osm_id,
          h.hazard_rule,
          h.hazard_type,
          h.priority,
          h.confidence,
          h.label,
          h.geom,
          h.dist_m,
          rm.tol_progress,
          CASE
            WHEN rm.route_geom IS NULL OR rm.route_len_m IS NULL OR rm.route_len_m <= 0 OR rm.is_off_route THEN NULL::double precision
            ELSE (ST_LineLocatePoint(rm.route_geom, ST_ClosestPoint(rm.route_geom, h.geom)) - rm.route_progress)
          END AS progress_delta,
          CASE
            WHEN rm.route_geom IS NULL OR rm.route_len_m IS NULL OR rm.route_len_m <= 0 OR rm.is_off_route THEN NULL::double precision
            ELSE rm.route_len_m * (ST_LineLocatePoint(rm.route_geom, ST_ClosestPoint(rm.route_geom, h.geom)) - rm.route_progress)
          END AS ahead_dist_m
        FROM hazards h
        CROSS JOIN route_metrics rm
      ),
      deduped AS (
        SELECT DISTINCT ON (source, osm_type, hazard_type, osm_id)
          source,
          osm_type,
          osm_id,
          hazard_rule,
          hazard_type,
          priority,
          confidence,
          label,
          geom,
          dist_m,
          tol_progress,
          progress_delta,
          ahead_dist_m
        FROM scored
        ORDER BY source, osm_type, hazard_type, osm_id, dist_m ASC
      )
      SELECT
        source,
        osm_type,
        osm_id,
        hazard_rule,
        hazard_type,
        priority,
        confidence,
        label,
        ST_Y(ST_Transform(geom, 4326)) AS lat,
        ST_X(ST_Transform(geom, 4326)) AS lon,
        dist_m,
        ahead_dist_m
      FROM deduped
      WHERE ($6::text[] IS NULL OR hazard_type = ANY($6))
        AND (
          NOT $8::boolean
          OR progress_delta IS NULL
          OR (
            progress_delta >= (-1 * COALESCE(tol_progress, 0))
            AND ahead_dist_m <= $9::double precision
          )
        )
      ORDER BY
        CASE WHEN $11::boolean THEN ahead_dist_m END ASC NULLS LAST,
        priority DESC,
        dist_m ASC
      LIMIT $7;
        `,
        [
          params.lon,
          params.lat,
          routeGeom,
          radiusM,
          routeCorridorM,
          types,
          limit,
          aheadOnly,
          aheadDistanceM,
          backtrackToleranceM,
          hasRouteContext,
          offRouteThresholdM,
        ],
      );
    } catch (error) {
      this.logDebug('nearby_query_failed', {
        message: (error as Error)?.message,
        mode,
        radiusM,
        limit,
        routeCorridorM,
        aheadOnly,
        aheadDistanceM,
        backtrackToleranceM,
        offRouteThresholdM,
      });
      return { source_status: 'osm_unavailable', radiusM, items: [] };
    }

    const result: NearbyHazardsResult = {
      source_status: 'ok',
      radiusM,
      items: this.toItems(rows, { preserveOrder: true }),
    };

    this.logDebug('nearby_query_ok', {
      mode,
      radiusM,
      limit,
      routeCorridorM,
      types,
      aheadOnly,
      aheadDistanceM,
      backtrackToleranceM,
      offRouteThresholdM,
      hasRouteContext,
      count: result.items.length,
    });

    this.setNearbyCache(cacheKey, result);
    return result;
  }

  private buildRouteHazardsUnionSql(
    availability: OsmAvailability,
    osmSrid: number,
    geomColumns: HazardGeomColumns,
  ): string {
    const pointGeomExpr = this.geomColumnRef('p', geomColumns.point);
    const segments: string[] = [
      this.pointTrafficLightSql('route', osmSrid, pointGeomExpr),
      this.pointMiniRoundaboutSql('route', osmSrid, pointGeomExpr),
      this.pointBusStopSql('route', osmSrid, pointGeomExpr),
      this.pointZebraSql('route', osmSrid, pointGeomExpr),
      this.pointCrossingGenericSql('route', osmSrid, pointGeomExpr),
      this.pointStopSql('route', osmSrid, pointGeomExpr),
      this.pointGiveWaySql('route', osmSrid, pointGeomExpr),
      this.pointSchoolSql('route', osmSrid, pointGeomExpr),
      this.pointGenericHazardSql('route', osmSrid, pointGeomExpr),
    ];

    if (availability.hasLineTable && geomColumns.line) {
      const lineGeomExpr = this.geomColumnRef('l', geomColumns.line);
      segments.push(this.lineRoundaboutSql('route', osmSrid, lineGeomExpr));
      segments.push(this.lineZebraSql('route', osmSrid, lineGeomExpr));
      segments.push(this.lineCrossingGenericSql('route', osmSrid, lineGeomExpr));
    }

    if (availability.hasPolygonTable && geomColumns.polygon) {
      const polygonGeomExpr = this.geomColumnRef('g', geomColumns.polygon);
      segments.push(this.polygonSchoolSql('route', osmSrid, polygonGeomExpr));
      segments.push(
        this.polygonGenericHazardSql('route', osmSrid, polygonGeomExpr),
      );
    }

    return segments.join('\n\nUNION ALL\n\n');
  }

  private buildNearbyHazardsUnionSql(
    availability: OsmAvailability,
    osmSrid: number,
    geomColumns: HazardGeomColumns,
  ): string {
    const pointGeomExpr = this.geomColumnRef('p', geomColumns.point);
    const segments: string[] = [
      this.pointTrafficLightSql('nearby', osmSrid, pointGeomExpr),
      this.pointMiniRoundaboutSql('nearby', osmSrid, pointGeomExpr),
      this.pointBusStopSql('nearby', osmSrid, pointGeomExpr),
      this.pointZebraSql('nearby', osmSrid, pointGeomExpr),
      this.pointCrossingGenericSql('nearby', osmSrid, pointGeomExpr),
      this.pointStopSql('nearby', osmSrid, pointGeomExpr),
      this.pointGiveWaySql('nearby', osmSrid, pointGeomExpr),
      this.pointSchoolSql('nearby', osmSrid, pointGeomExpr),
      this.pointGenericHazardSql('nearby', osmSrid, pointGeomExpr),
    ];

    if (availability.hasLineTable && geomColumns.line) {
      const lineGeomExpr = this.geomColumnRef('l', geomColumns.line);
      segments.push(this.lineRoundaboutSql('nearby', osmSrid, lineGeomExpr));
      segments.push(this.lineZebraSql('nearby', osmSrid, lineGeomExpr));
      segments.push(this.lineCrossingGenericSql('nearby', osmSrid, lineGeomExpr));
    }

    if (availability.hasPolygonTable && geomColumns.polygon) {
      const polygonGeomExpr = this.geomColumnRef('g', geomColumns.polygon);
      segments.push(this.polygonSchoolSql('nearby', osmSrid, polygonGeomExpr));
      segments.push(
        this.polygonGenericHazardSql('nearby', osmSrid, polygonGeomExpr),
      );
    }

    return segments.join('\n\nUNION ALL\n\n');
  }

  private pointTrafficLightSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    pointGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'point'::text AS osm_type,
        p.osm_id,
        'traffic_signals'::text AS hazard_rule,
        ${pointGeomExpr} AS geom,
        'traffic_light'::text AS hazard_type,
        80::int AS priority,
        0.9::float AS confidence,
        COALESCE((p.tags -> 'name'), 'Traffic lights') AS label,
        ${this.distanceExpr(pointGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_point p
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(pointGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(pointGeomExpr, mode, osmSrid)}
        AND p.highway = 'traffic_signals'
    `;
  }

  private pointMiniRoundaboutSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    pointGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'point'::text AS osm_type,
        p.osm_id,
        'mini_roundabout'::text AS hazard_rule,
        ${pointGeomExpr} AS geom,
        'mini_roundabout'::text AS hazard_type,
        86::int AS priority,
        0.86::float AS confidence,
        COALESCE((p.tags -> 'name'), 'Mini roundabout') AS label,
        ${this.distanceExpr(pointGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_point p
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(pointGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(pointGeomExpr, mode, osmSrid)}
        AND (
          p.highway = 'mini_roundabout'
          OR (p.tags -> 'highway') = 'mini_roundabout'
          OR (p.tags -> 'junction') = 'mini_roundabout'
          OR (p.tags -> 'mini_roundabout') = 'yes'
        )
    `;
  }

  private pointBusStopSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    pointGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'point'::text AS osm_type,
        p.osm_id,
        'bus_stop'::text AS hazard_rule,
        ${pointGeomExpr} AS geom,
        'bus_stop'::text AS hazard_type,
        66::int AS priority,
        0.72::float AS confidence,
        COALESCE((p.tags -> 'name'), 'Bus stop') AS label,
        ${this.distanceExpr(pointGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_point p
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(pointGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(pointGeomExpr, mode, osmSrid)}
        AND (
          p.highway = 'bus_stop'
          OR (p.tags -> 'highway') = 'bus_stop'
          OR (
            (p.tags -> 'public_transport') = 'platform'
            AND (
              COALESCE((p.tags -> 'bus'), '') = 'yes'
              OR COALESCE((p.tags -> 'highway'), '') = 'bus_stop'
            )
          )
        )
    `;
  }

  private pointZebraSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    pointGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'point'::text AS osm_type,
        p.osm_id,
        'zebra_explicit'::text AS hazard_rule,
        ${pointGeomExpr} AS geom,
        'zebra_crossing'::text AS hazard_type,
        85::int AS priority,
        0.85::float AS confidence,
        COALESCE((p.tags -> 'name'), 'Zebra crossing') AS label,
        ${this.distanceExpr(pointGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_point p
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(pointGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(pointGeomExpr, mode, osmSrid)}
        AND p.highway = 'crossing'
        AND (
          (p.tags -> 'crossing') = 'zebra'
          OR (p.tags -> 'crossing:markings') = 'zebra'
          OR (p.tags -> 'crossing_ref') = 'zebra'
        )
    `;
  }

  private pointCrossingGenericSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    pointGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'point'::text AS osm_type,
        p.osm_id,
        'crossing_generic'::text AS hazard_rule,
        ${pointGeomExpr} AS geom,
        'hazard_generic'::text AS hazard_type,
        50::int AS priority,
        0.5::float AS confidence,
        COALESCE((p.tags -> 'name'), 'Road crossing') AS label,
        ${this.distanceExpr(pointGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_point p
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(pointGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(pointGeomExpr, mode, osmSrid)}
        AND p.highway = 'crossing'
        AND NOT (
          (p.tags -> 'crossing') = 'zebra'
          OR (p.tags -> 'crossing:markings') = 'zebra'
          OR (p.tags -> 'crossing_ref') = 'zebra'
        )
    `;
  }

  private pointStopSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    pointGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'point'::text AS osm_type,
        p.osm_id,
        'stop_sign'::text AS hazard_rule,
        ${pointGeomExpr} AS geom,
        'stop_sign'::text AS hazard_type,
        78::int AS priority,
        0.9::float AS confidence,
        COALESCE((p.tags -> 'name'), 'Stop sign') AS label,
        ${this.distanceExpr(pointGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_point p
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(pointGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(pointGeomExpr, mode, osmSrid)}
        AND p.highway = 'stop'
    `;
  }

  private pointGiveWaySql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    pointGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'point'::text AS osm_type,
        p.osm_id,
        'give_way'::text AS hazard_rule,
        ${pointGeomExpr} AS geom,
        'give_way'::text AS hazard_type,
        74::int AS priority,
        0.9::float AS confidence,
        COALESCE((p.tags -> 'name'), 'Give way') AS label,
        ${this.distanceExpr(pointGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_point p
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(pointGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(pointGeomExpr, mode, osmSrid)}
        AND p.highway = 'give_way'
    `;
  }

  private pointSchoolSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    pointGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'point'::text AS osm_type,
        p.osm_id,
        CASE
          WHEN p.amenity = 'school' THEN 'school_amenity'
          WHEN (p.tags -> 'hazard') IN ('school_zone', 'children') THEN 'school_hazard_tag'
          ELSE 'school_zone_traffic'
        END::text AS hazard_rule,
        ${pointGeomExpr} AS geom,
        'school_warning'::text AS hazard_type,
        CASE
          WHEN p.amenity = 'school' THEN 86
          WHEN (p.tags -> 'hazard') IN ('school_zone', 'children') THEN 92
          ELSE 90
        END::int AS priority,
        CASE
          WHEN p.amenity = 'school' THEN 0.6
          WHEN (p.tags -> 'hazard') IN ('school_zone', 'children') THEN 0.75
          ELSE 0.7
        END::float AS confidence,
        COALESCE((p.tags -> 'name'), 'School warning') AS label,
        ${this.distanceExpr(pointGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_point p
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(pointGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(pointGeomExpr, mode, osmSrid)}
        AND (
          (p.amenity = 'school' AND r.geom IS NOT NULL)
          OR
          (p.tags -> 'hazard') IN ('school_zone', 'children')
          OR (p.tags -> 'zone:traffic') = 'school'
          OR (p.tags -> 'maxspeed:type') = 'school_zone'
        )
    `;
  }

  private pointGenericHazardSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    pointGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'point'::text AS osm_type,
        p.osm_id,
        'hazard_generic_tag'::text AS hazard_rule,
        ${pointGeomExpr} AS geom,
        'hazard_generic'::text AS hazard_type,
        50::int AS priority,
        0.5::float AS confidence,
        COALESCE((p.tags -> 'hazard'), 'Road hazard') AS label,
        ${this.distanceExpr(pointGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_point p
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(pointGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(pointGeomExpr, mode, osmSrid)}
        AND (p.tags ? 'hazard')
        AND COALESCE((p.tags -> 'hazard'), '') NOT IN ('school_zone', 'children')
    `;
  }

  private lineZebraSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    lineGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'line'::text AS osm_type,
        l.osm_id,
        'zebra_explicit'::text AS hazard_rule,
        ${lineGeomExpr} AS geom,
        'zebra_crossing'::text AS hazard_type,
        85::int AS priority,
        0.85::float AS confidence,
        COALESCE((l.tags -> 'name'), 'Zebra crossing') AS label,
        ${this.distanceExpr(lineGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_line l
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(lineGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(lineGeomExpr, mode, osmSrid)}
        AND l.highway = 'crossing'
        AND (
          (l.tags -> 'crossing') = 'zebra'
          OR (l.tags -> 'crossing:markings') = 'zebra'
          OR (l.tags -> 'crossing_ref') = 'zebra'
        )
    `;
  }

  private lineRoundaboutSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    lineGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'line'::text AS osm_type,
        l.osm_id,
        'roundabout'::text AS hazard_rule,
        ST_PointOnSurface(${lineGeomExpr}) AS geom,
        'roundabout'::text AS hazard_type,
        88::int AS priority,
        0.88::float AS confidence,
        COALESCE((l.tags -> 'name'), 'Roundabout') AS label,
        ${this.distanceExpr(lineGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_line l
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(lineGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(lineGeomExpr, mode, osmSrid)}
        AND (
          l.junction = 'roundabout'
          OR (l.tags -> 'junction') = 'roundabout'
        )
    `;
  }

  private lineCrossingGenericSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    lineGeomExpr: string,
  ): string {
    return `
      SELECT
        'osm'::text AS source,
        'line'::text AS osm_type,
        l.osm_id,
        'crossing_generic'::text AS hazard_rule,
        ${lineGeomExpr} AS geom,
        'hazard_generic'::text AS hazard_type,
        50::int AS priority,
        0.5::float AS confidence,
        COALESCE((l.tags -> 'name'), 'Road crossing') AS label,
        ${this.distanceExpr(lineGeomExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_line l
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(lineGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(lineGeomExpr, mode, osmSrid)}
        AND l.highway = 'crossing'
        AND NOT (
          (l.tags -> 'crossing') = 'zebra'
          OR (l.tags -> 'crossing:markings') = 'zebra'
          OR (l.tags -> 'crossing_ref') = 'zebra'
        )
    `;
  }

  private polygonSchoolSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    polygonGeomExpr: string,
  ): string {
    const polygonPointExpr = `ST_PointOnSurface(${polygonGeomExpr})`;
    return `
      SELECT
        'osm'::text AS source,
        'polygon'::text AS osm_type,
        g.osm_id,
        CASE
          WHEN g.amenity = 'school' THEN 'school_amenity'
          WHEN (g.tags -> 'hazard') IN ('school_zone', 'children') THEN 'school_hazard_tag'
          ELSE 'school_zone_traffic'
        END::text AS hazard_rule,
        ${polygonPointExpr} AS geom,
        'school_warning'::text AS hazard_type,
        CASE
          WHEN g.amenity = 'school' THEN 86
          WHEN (g.tags -> 'hazard') IN ('school_zone', 'children') THEN 92
          ELSE 90
        END::int AS priority,
        CASE
          WHEN g.amenity = 'school' THEN 0.6
          WHEN (g.tags -> 'hazard') IN ('school_zone', 'children') THEN 0.75
          ELSE 0.7
        END::float AS confidence,
        COALESCE((g.tags -> 'name'), 'School zone') AS label,
        ${this.distanceExpr(polygonPointExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_polygon g
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(polygonGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(polygonGeomExpr, mode, osmSrid)}
        AND (
          (g.amenity = 'school' AND r.geom IS NOT NULL)
          OR (g.tags -> 'hazard') IN ('school_zone', 'children')
          OR (g.tags -> 'zone:traffic') = 'school'
          OR (g.tags -> 'maxspeed:type') = 'school_zone'
        )
    `;
  }

  private polygonGenericHazardSql(
    mode: 'route' | 'nearby',
    osmSrid: number,
    polygonGeomExpr: string,
  ): string {
    const polygonPointExpr = `ST_PointOnSurface(${polygonGeomExpr})`;
    return `
      SELECT
        'osm'::text AS source,
        'polygon'::text AS osm_type,
        g.osm_id,
        'hazard_generic_tag'::text AS hazard_rule,
        ${polygonPointExpr} AS geom,
        'hazard_generic'::text AS hazard_type,
        45::int AS priority,
        0.5::float AS confidence,
        COALESCE((g.tags -> 'hazard'), 'Road hazard') AS label,
        ${this.distanceExpr(polygonPointExpr, mode, osmSrid)} AS dist_m
      FROM planet_osm_polygon g
      ${this.scopeSql(mode)}
      WHERE
        -- Spatial predicate first so GiST index narrows candidates before tag/hstore predicates.
        ${this.withinPrimaryExpr(polygonGeomExpr, mode, osmSrid)}
        ${this.routeGuardExpr(polygonGeomExpr, mode, osmSrid)}
        AND (g.tags ? 'hazard')
        AND COALESCE((g.tags -> 'hazard'), '') NOT IN ('school_zone', 'children')
    `;
  }

  private scopeSql(mode: 'route' | 'nearby'): string {
    if (mode === 'route') {
      return 'CROSS JOIN route_line r';
    }
    return 'CROSS JOIN center_point c CROSS JOIN route_line r';
  }

  private distanceExpr(
    geomExpr: string,
    mode: 'route' | 'nearby',
    osmSrid: number,
  ): string {
    void osmSrid;
    if (mode === 'route') {
      return this.sqlDistanceM(geomExpr, 'r.geom');
    }
    return this.sqlDistanceM(geomExpr, 'c.geom');
  }

  private withinPrimaryExpr(
    geomExpr: string,
    mode: 'route' | 'nearby',
    osmSrid: number,
  ): string {
    void osmSrid;
    if (mode === 'route') {
      return this.sqlDWithin(geomExpr, 'r.geom', '$2');
    }
    return this.sqlDWithin(geomExpr, 'c.geom', '$4');
  }

  private routeGuardExpr(
    geomExpr: string,
    mode: 'route' | 'nearby',
    osmSrid: number,
  ): string {
    void osmSrid;
    if (mode === 'route') {
      return '';
    }
    return `AND (r.geom IS NULL OR ${this.sqlDWithin(geomExpr, 'r.geom', '$5')})`;
  }

  private sqlDistanceM(leftGeomExpr: string, rightGeomExpr: string): string {
    const osmSrid = this.resolveOsmSrid();
    if (osmSrid === 4326) {
      return `ST_Distance(${leftGeomExpr}::geography, ${rightGeomExpr}::geography)`;
    }
    return `ST_Distance(${leftGeomExpr}, ${rightGeomExpr})`;
  }

  private sqlDWithin(
    leftGeomExpr: string,
    rightGeomExpr: string,
    distanceParamExpr: string,
  ): string {
    const osmSrid = this.resolveOsmSrid();
    if (osmSrid === 4326) {
      return `ST_DWithin(${leftGeomExpr}::geography, ${rightGeomExpr}::geography, ${distanceParamExpr})`;
    }
    return `ST_DWithin(${leftGeomExpr}, ${rightGeomExpr}, ${distanceParamExpr})`;
  }

  private metricLengthExpr(geomExpr: string, osmSrid: number): string {
    if (osmSrid === 4326) {
      return `ST_Length(${geomExpr}::geography)`;
    }
    return `ST_Length(${geomExpr})`;
  }

  private toItems(
    rows: HazardQueryRow[],
    options?: { preserveOrder?: boolean },
  ): RoadHazardItem[] {
    type Candidate = RoadHazardItem & {
      sourceKey: string;
      osmType: string;
      osmId: string;
    };

    const candidates: Candidate[] = [];
    for (const row of rows ?? []) {
      const mapped = this.mapRowUsingRules(row);
      if (!mapped) continue;
      candidates.push(mapped);
    }

    // Primary dedup: exact same OSM object + mapped type.
    const primaryDeduped = this.dedupeByPrimaryKey(candidates);
    // Fallback dedup: same mapped type within 8m keeps highest priority/confidence.
    const spatialDeduped = this.dedupeSpatialFallback(primaryDeduped, 8);

    if (options?.preserveOrder) {
      return spatialDeduped.sort((a, b) => {
        const aAhead = a.aheadDistM ?? Number.POSITIVE_INFINITY;
        const bAhead = b.aheadDistM ?? Number.POSITIVE_INFINITY;
        if (aAhead !== bAhead) return aAhead - bAhead;
        if (a.priority !== b.priority) return b.priority - a.priority;
        return (a.distM ?? 0) - (b.distM ?? 0);
      });
    }

    return spatialDeduped.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return (a.distM ?? 0) - (b.distM ?? 0);
    });
  }

  private mapRowUsingRules(row: HazardQueryRow): (RoadHazardItem & {
    sourceKey: string;
    osmType: string;
    osmId: string;
  }) | null {
    const rule = HAZARD_RULES[row.hazard_rule];
    if (!rule) return null;

    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!this.isValidLonLat(lon, lat)) return null;

    const distRaw = Number(row.dist_m);
    const aheadDistRaw = Number(row.ahead_dist_m);
    const osmId = String(row.osm_id);
    const sourceKey = String(row.source || 'osm');
    const osmType = String(row.osm_type || 'unknown');

    const item: RoadHazardItem & {
      sourceKey: string;
      osmType: string;
      osmId: string;
    } = {
      id: `${rule.type}:${sourceKey}:${osmType}:${osmId}`,
      type: rule.type,
      lat,
      lon,
      priority: rule.priority,
      source: 'osm',
      confidence: rule.confidence,
      labels: { primary: row.label ?? null },
      sourceKey,
      osmType,
      osmId,
    };

    if (Number.isFinite(distRaw)) item.distM = Math.round(distRaw);
    if (Number.isFinite(aheadDistRaw)) item.aheadDistM = Math.round(aheadDistRaw);

    return item;
  }

  private dedupeByPrimaryKey<T extends RoadHazardItem & {
    sourceKey: string;
    osmType: string;
    osmId: string;
  }>(items: T[]): T[] {
    const byPrimary = new Map<string, T>();
    for (const item of items) {
      const key = `${item.sourceKey}:${item.osmType}:${item.osmId}:${item.type}`;
      const existing = byPrimary.get(key);
      if (!existing || this.isBetterHazard(item, existing)) {
        byPrimary.set(key, item);
      }
    }
    return [...byPrimary.values()];
  }

  private dedupeSpatialFallback<T extends RoadHazardItem>(items: T[], thresholdM: number): T[] {
    const output: T[] = [];

    for (const candidate of items) {
      let matchedIndex = -1;
      for (let i = 0; i < output.length; i++) {
        const existing = output[i];
        if (existing.type !== candidate.type) continue;
        const dist = this.haversineMeters(
          candidate.lon,
          candidate.lat,
          existing.lon,
          existing.lat,
        );
        if (dist <= thresholdM) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex === -1) {
        output.push(candidate);
        continue;
      }

      if (this.isBetterHazard(candidate, output[matchedIndex])) {
        output[matchedIndex] = candidate;
      }
    }

    return output;
  }

  private isBetterHazard(a: RoadHazardItem, b: RoadHazardItem): boolean {
    if (a.priority !== b.priority) return a.priority > b.priority;
    if (a.confidence !== b.confidence) return a.confidence > b.confidence;
    return (a.distM ?? Number.POSITIVE_INFINITY) < (b.distM ?? Number.POSITIVE_INFINITY);
  }

  private haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const r = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return r * c;
  }

  private normalizeTypes(types?: RoadHazardType[] | string[] | null): RoadHazardType[] | null {
    if (!Array.isArray(types) || types.length === 0) return null;
    const allowed = new Set<RoadHazardType>(ROAD_HAZARD_TYPES);
    const normalized = [...new Set(types.map((x) => String(x).trim() as RoadHazardType))].filter((x) =>
      allowed.has(x),
    );
    return normalized.length ? normalized : null;
  }

  private buildNearbyCacheKey(input: {
    lat: number;
    lon: number;
    mode: string;
    radiusM: number;
    limit: number;
    routeCorridorM: number;
    types: RoadHazardType[] | null;
    routeId: string | null;
    routeCoords: Array<[number, number]>;
    aheadOnly: boolean;
    aheadDistanceM: number;
    backtrackToleranceM: number;
    offRouteThresholdM: number;
  }): string {
    // Cache key intentionally avoids raw coordinates; it uses ~11m grid cells.
    const cellLat = Math.floor(input.lat * 10_000);
    const cellLon = Math.floor(input.lon * 10_000);
    const routeFingerprint = this.routeFingerprint(input.routeCoords);
    const routeRef = input.routeId
      ? `id:${input.routeId}`
      : `fp:${routeFingerprint}`;
    const typesKey = input.types?.slice().sort().join('|') ?? '*';
    return [
      'nearby-v2',
      input.mode,
      `cell:${cellLat}:${cellLon}`,
      input.radiusM.toFixed(0),
      input.limit,
      input.routeCorridorM.toFixed(0),
      routeRef,
      input.aheadOnly ? 'ahead' : 'all',
      input.aheadDistanceM.toFixed(0),
      input.backtrackToleranceM.toFixed(0),
      input.offRouteThresholdM.toFixed(0),
      typesKey,
      routeFingerprint,
    ].join(':');
  }

  private routeFingerprint(coords: Array<[number, number]>): string {
    if (!coords.length) return 'none';
    const first = coords[0];
    const mid = coords[Math.floor(coords.length / 2)];
    const last = coords[coords.length - 1];
    return `${coords.length}|${first[0].toFixed(4)},${first[1].toFixed(4)}|${mid[0].toFixed(4)},${mid[1].toFixed(4)}|${last[0].toFixed(4)},${last[1].toFixed(4)}`;
  }

  private getNearbyFromCache(key: string): NearbyHazardsResult | null {
    const entry = this.nearbyCache.get(key);
    this.recordNearbyCacheLookup(Boolean(entry));
    return entry;
  }

  private setNearbyCache(key: string, value: NearbyHazardsResult): void {
    this.nearbyCache.set(key, value);
  }

  private recordNearbyCacheLookup(hit: boolean): void {
    this.nearbyCacheLookups += 1;
    if (hit) this.nearbyCacheHits += 1;
    else this.nearbyCacheMisses += 1;

    if (!this.debugLogs) return;
    if (this.nearbyCacheLookups % 50 !== 0) return;

    const hitRate = this.nearbyCacheLookups
      ? Number(((this.nearbyCacheHits / this.nearbyCacheLookups) * 100).toFixed(2))
      : 0;
    this.logDebug('nearby_cache_metrics', {
      lookups: this.nearbyCacheLookups,
      hits: this.nearbyCacheHits,
      misses: this.nearbyCacheMisses,
      hitRatePct: hitRate,
      size: this.nearbyCache.size(),
      maxEntries: this.nearbyCacheMaxEntries,
      ttlMs: this.nearbyCacheTtlMs,
    });
  }

  private isAllowedOsmTable(tableName: string): tableName is OSMTableName {
    return OSM_TABLE_WHITELIST.has(tableName as OSMTableName);
  }

  private isSafeSqlIdentifier(identifier: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
  }

  private quoteSqlIdentifier(identifier: string): string {
    if (!this.isSafeSqlIdentifier(identifier)) {
      throw new Error(`Unsafe SQL identifier: ${identifier}`);
    }
    return `"${identifier}"`;
  }

  private geomColumnRef(alias: string, columnName: string): string {
    return `${alias}.${this.quoteSqlIdentifier(columnName)}`;
  }

  private async detectOsmGeomColumn(tableName: string): Promise<string | null> {
    if (!this.isAllowedOsmTable(tableName)) {
      return null;
    }

    try {
      const rows = await this.dataSource.query(
        `
        SELECT a.attname AS column_name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_type t ON t.oid = a.atttypid
        WHERE n.nspname = 'public'
          AND c.relname = $1
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND t.typname = 'geometry'
        ORDER BY
          CASE a.attname
            WHEN 'way' THEN 0
            WHEN 'geom' THEN 1
            WHEN 'geometry' THEN 2
            WHEN 'wkb_geometry' THEN 3
            ELSE 100
          END ASC,
          a.attnum ASC;
      `,
        [tableName],
      );

      for (const row of rows ?? []) {
        const columnName = String(row?.column_name ?? '').trim();
        if (this.isSafeSqlIdentifier(columnName)) {
          return columnName;
        }
      }
      return null;
    } catch (error) {
      this.logDebug('osm_geom_detect_failed', {
        tableName,
        message: (error as Error)?.message,
      });
      return null;
    }
  }

  private async getOsmGeomColumn(tableName: string): Promise<string> {
    if (!this.isAllowedOsmTable(tableName)) {
      throw new Error(`Unsupported OSM table: ${tableName}`);
    }

    if (this.osmGeomColumnCache.has(tableName)) {
      const cached = this.osmGeomColumnCache.get(tableName) ?? null;
      if (cached) return cached;
      throw new Error(`OSM geometry column not found for table: ${tableName}`);
    }

    const detected = await this.detectOsmGeomColumn(tableName);
    this.osmGeomColumnCache.set(tableName, detected);
    if (!detected) {
      throw new Error(`OSM geometry column not found for table: ${tableName}`);
    }
    return detected;
  }

  private async resolveHazardGeomColumns(
    availability: OsmAvailability,
  ): Promise<HazardGeomColumns | null> {
    try {
      if (!availability.hasPointTable) {
        return null;
      }

      const point = await this.getOsmGeomColumn('planet_osm_point');
      let line: string | null = null;
      let polygon: string | null = null;

      if (availability.hasLineTable) {
        try {
          line = await this.getOsmGeomColumn('planet_osm_line');
        } catch (error) {
          this.logDebug('osm_geom_optional_missing', {
            tableName: 'planet_osm_line',
            message: (error as Error)?.message,
          });
        }
      }

      if (availability.hasPolygonTable) {
        try {
          polygon = await this.getOsmGeomColumn('planet_osm_polygon');
        } catch (error) {
          this.logDebug('osm_geom_optional_missing', {
            tableName: 'planet_osm_polygon',
            message: (error as Error)?.message,
          });
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        this.logDebug('osm_geom_columns', {
          point,
          line,
          polygon,
        });
      }

      return { point, line, polygon };
    } catch (error) {
      this.logDebug('osm_geom_required_missing', {
        message: (error as Error)?.message,
      });
      return null;
    }
  }

  private resolveOsmSrid(): number {
    return this.osmSridCache ?? 3857;
  }

  private async ensureOsmSridResolved(
    geomColumns?: Partial<Record<OSMTableName, string | null>>,
  ): Promise<number> {
    if (this.osmSridCache != null) {
      return this.osmSridCache;
    }
    if (this.osmSridResolvePromise) {
      return this.osmSridResolvePromise;
    }

    this.osmSridResolvePromise = (async () => {
      const fallbackSrid = 3857;
      try {
        const availability = await this.getOsmAvailability();
        const candidateTables: OSMTableName[] = [
          'planet_osm_point',
          'planet_osm_line',
          'planet_osm_polygon',
        ];

        for (const tableName of candidateTables) {
          const tableAvailable =
            (tableName === 'planet_osm_point' && availability.hasPointTable) ||
            (tableName === 'planet_osm_line' && availability.hasLineTable) ||
            (tableName === 'planet_osm_polygon' && availability.hasPolygonTable);
          if (!tableAvailable) continue;

          const geomColumn =
            geomColumns?.[tableName] ??
            (await this.detectOsmGeomColumn(tableName));
          if (!geomColumn) continue;
          const geomRef = this.quoteSqlIdentifier(geomColumn);

          const rows = await this.dataSource.query(
            `SELECT ST_SRID(${geomRef}) AS srid FROM ${tableName} WHERE ${geomRef} IS NOT NULL LIMIT 1`,
          );
          const srid = Number(rows?.[0]?.srid);
          if (Number.isFinite(srid) && srid > 0) {
            this.osmSridCache = srid;
            this.logDebug('osm_srid_resolved', { srid, tableName });
            return srid;
          }
        }
      } catch (error) {
        this.logDebug('osm_srid_resolve_failed', {
          message: (error as Error)?.message,
        });
      }

      this.osmSridCache = fallbackSrid;
      this.logDebug('osm_srid_resolved', { srid: fallbackSrid, fallback: true });
      return fallbackSrid;
    })();

    try {
      return await this.osmSridResolvePromise;
    } finally {
      this.osmSridResolvePromise = null;
    }
  }

  private toOsmGeom(
    pointWgs84: { lonExpr: string; latExpr: string },
    osmSrid: number,
  ): string {
    const wgs84Point = `ST_SetSRID(ST_MakePoint(${pointWgs84.lonExpr}, ${pointWgs84.latExpr}), 4326)`;
    if (osmSrid === 4326) return wgs84Point;
    return `ST_Transform(${wgs84Point}, ${osmSrid})`;
  }

  private routeLineToOsmSrid(
    routeCoords: Array<[number, number]>,
    osmSrid: number,
    geoJsonParamExpr: string,
  ): { geojson: string; sqlExpr: string } {
    const geojson = JSON.stringify({
      type: 'LineString',
      coordinates: routeCoords,
    });
    const wgs84Line = `ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonParamExpr}), 4326)`;
    const sqlExpr =
      osmSrid === 4326 ? wgs84Line : `ST_Transform(${wgs84Line}, ${osmSrid})`;
    return { geojson, sqlExpr };
  }

  private validateCrsConfiguration(osmSrid: number): void {
    if (process.env.NODE_ENV === 'production' || this.crsValidationLogged) {
      return;
    }
    this.crsValidationLogged = true;
    const distanceMode =
      osmSrid === 4326 ? 'geography_meter_ops' : 'projected_geometry_meter_ops';
    console.debug(
      `[RoadHazardService] crs_validation ${JSON.stringify({
        osmSrid,
        distanceMode,
      })}`,
    );
  }

  private async getOsmAvailability(): Promise<OsmAvailability> {
    const now = Date.now();
    if (this.osmReadyCache && now - this.osmReadyCache.checkedAt < 60_000) {
      return this.osmReadyCache;
    }

    try {
      const rows = await this.dataSource.query(
        `
        WITH refs AS (
          SELECT
            to_regclass('public.planet_osm_point') AS point_table,
            to_regclass('public.planet_osm_line') AS line_table,
            to_regclass('public.planet_osm_polygon') AS polygon_table
        ),
        ext AS (
          SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'hstore'
          ) AS has_hstore
        )
        SELECT
          refs.point_table,
          refs.line_table,
          refs.polygon_table,
          ext.has_hstore,
          CASE
            WHEN refs.point_table IS NOT NULL THEN EXISTS (SELECT 1 FROM planet_osm_point LIMIT 1)
            ELSE false
          END AS point_has_rows,
          CASE
            WHEN refs.line_table IS NOT NULL THEN EXISTS (SELECT 1 FROM planet_osm_line LIMIT 1)
            ELSE false
          END AS line_has_rows,
          CASE
            WHEN refs.polygon_table IS NOT NULL THEN EXISTS (SELECT 1 FROM planet_osm_polygon LIMIT 1)
            ELSE false
          END AS polygon_has_rows
        FROM refs
        CROSS JOIN ext;
        `,
      );

      const row = rows?.[0] ?? {};
      const hasPointTable = Boolean(row.point_table);
      const hasLineTable = Boolean(row.line_table);
      const hasPolygonTable = Boolean(row.polygon_table);
      const hasHstore = Boolean(row.has_hstore);
      const hasRows = Boolean(row.point_has_rows || row.line_has_rows || row.polygon_has_rows);

      const ok = hasPointTable && hasHstore && hasRows;

      this.osmReadyCache = {
        ok,
        status: ok ? 'ok' : 'osm_unavailable',
        checkedAt: now,
        hasPointTable,
        hasLineTable,
        hasPolygonTable,
        hasHstore,
      };

      this.logDebug('osm_availability', {
        ok,
        hasPointTable,
        hasLineTable,
        hasPolygonTable,
        hasHstore,
      });

      return this.osmReadyCache;
    } catch (error) {
      this.logDebug('osm_availability_failed', {
        message: (error as Error)?.message,
      });
      this.osmReadyCache = {
        ok: false,
        status: 'osm_unavailable',
        checkedAt: now,
        hasPointTable: false,
        hasLineTable: false,
        hasPolygonTable: false,
        hasHstore: false,
      };
      return this.osmReadyCache;
    }
  }

  private fromCoordinates(rawCoordinates: any): Array<[number, number]> {
    if (!Array.isArray(rawCoordinates)) return [];
    const out: Array<[number, number]> = [];

    for (const c of rawCoordinates) {
      if (Array.isArray(c) && c.length >= 2) {
        const lon = Number(c[0]);
        const lat = Number(c[1]);
        if (this.isValidLonLat(lon, lat)) out.push([lon, lat]);
        continue;
      }

      if (c && typeof c === 'object') {
        const lon = Number((c as any).lon ?? (c as any).lng ?? (c as any).longitude);
        const lat = Number((c as any).lat ?? (c as any).latitude);
        if (this.isValidLonLat(lon, lat)) out.push([lon, lat]);
      }
    }

    return out;
  }

  private fromGeojson(rawGeojson: any): Array<[number, number]> {
    if (!rawGeojson || typeof rawGeojson !== 'object') return [];

    if (rawGeojson.type === 'FeatureCollection' && Array.isArray(rawGeojson.features)) {
      const lineFeature = rawGeojson.features.find(
        (f: any) => f?.geometry?.type === 'LineString' && Array.isArray(f?.geometry?.coordinates),
      );
      if (lineFeature) return this.fromCoordinates(lineFeature.geometry.coordinates);
    }

    if (rawGeojson.type === 'Feature' && rawGeojson.geometry?.type === 'LineString') {
      return this.fromCoordinates(rawGeojson.geometry.coordinates);
    }

    if (rawGeojson.type === 'LineString' && Array.isArray(rawGeojson.coordinates)) {
      return this.fromCoordinates(rawGeojson.coordinates);
    }

    return [];
  }

  private dedupeCoordinates(coords: Array<[number, number]>): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (const c of coords) {
      const last = out[out.length - 1];
      if (!last || last[0] !== c[0] || last[1] !== c[1]) {
        out.push(c);
      }
    }
    return out;
  }

  private isValidLonLat(lon: number, lat: number): boolean {
    return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  private clampInt(value: number, min: number, max: number): number {
    return Math.round(this.clamp(value, min, max));
  }

  private envBool(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw == null) return fallback;
    const normalized = String(raw).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private resolveOsmSnapshotFromEnv(): string | null {
    const raw =
      process.env.OSM_IMPORT_TIMESTAMP ??
      process.env.OSM_SNAPSHOT_TIMESTAMP ??
      process.env.OSM_SNAPSHOT ??
      process.env.OSM_DATA_TIMESTAMP;
    if (!raw) return null;
    const value = String(raw).trim();
    return value.length ? value : null;
  }

  private logDebug(event: string, payload: Record<string, unknown>): void {
    if (!this.debugLogs) return;
    try {
      console.log(`[RoadHazardService] ${event} ${JSON.stringify(payload)}`);
    } catch {
      console.log(`[RoadHazardService] ${event}`);
    }
  }
}
