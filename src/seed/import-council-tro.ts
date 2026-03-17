import axios from 'axios';
import { createHash } from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import dataSource from '../database/typeorm.config';

type HazardType =
  | 'traffic_light'
  | 'zebra_crossing'
  | 'roundabout'
  | 'mini_roundabout'
  | 'bus_lane'
  | 'bus_stop'
  | 'speed_camera'
  | 'stop_sign'
  | 'give_way'
  | 'school_warning'
  | 'hazard_generic';

type GeoJSONGeometry = {
  type: string;
  coordinates?: unknown;
  geometries?: GeoJSONGeometry[];
} | null;

type GeoJSONFeature = {
  type?: string;
  id?: string | number;
  geometry?: GeoJSONGeometry;
  properties?: Record<string, unknown> | null;
  _sourceSrid?: number;
};

type GeoJSONCollection = {
  type?: string;
  features?: GeoJSONFeature[];
};

type TroSourceConfig = {
  id: string;
  sourceName: string;
  authorityName: string;
  datasetUrl: string;
  datasetFormat?: 'geojson' | 'wfs_gml';
  hazardType: HazardType;
  priority: number;
  confidence: number;
  includeAll?: boolean;
  includeRegex?: string;
  includeFields?: string[];
  labelFields?: string[];
};

type ParsedArgs = {
  apply: boolean;
  sourceIds: Set<string> | null;
  allowEmptySync: boolean;
  ttlDays: number;
  timeoutMs: number;
  maxFeaturesPerSource: number;
};

const FREE_TRO_SOURCES: TroSourceConfig[] = [
  {
    id: 'city_of_london_bus_lanes',
    sourceName: 'City of London Bus Lanes (WFS)',
    authorityName: 'City of London',
    datasetUrl:
      'https://www.mapping.cityoflondon.gov.uk/arcgis/services/INSPIRE/MapServer/WFSServer?service=WFS&version=2.0.0&request=GetFeature&typeNames=INSPIRE:Bus_Lanes&outputFormat=GEOJSON&srsName=EPSG:4326',
    hazardType: 'bus_lane',
    priority: 95,
    confidence: 0.98,
    includeAll: true,
    labelFields: ['Street_Name', 'Description', 'Traffic_Management_Order_Number'],
  },
  {
    id: 'belfast_bus_lane_cycle_provision',
    sourceName: 'Belfast Bus Lane with Cycle Provision',
    authorityName: 'OpenDataNI / DfI',
    datasetUrl:
      'https://services1.arcgis.com/i8LHQZrSk9zIffRU/arcgis/rest/services/CyclingInfrastructurePublicViewer/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson',
    hazardType: 'bus_lane',
    priority: 93,
    confidence: 0.95,
    includeAll: true,
    labelFields: ['Name', 'Council', 'LegislationRef'],
  },
  {
    id: 'bradford_tro_bus_lane_filtered',
    sourceName: 'Bradford TRO (Bus-Lane Filter)',
    authorityName: 'City of Bradford Metropolitan District Council',
    datasetUrl:
      'https://spatialdata-cbmdc.hub.arcgis.com/api/download/v1/items/33845468211a466cba6d28ece9eb91ac/geojson?layers=0',
    hazardType: 'bus_lane',
    priority: 92,
    confidence: 0.94,
    includeRegex: '\\b(bus\\s*lane|bus\\s*gate|bus\\s*only|psv)\\b',
    includeFields: ['ORDER_TYPE', 'RESTRICTIO', 'ORDER_REF'],
    labelFields: ['ORDER_TYPE', 'ORDER_REF'],
  },
  {
    id: 'bracknell_tro_bus_stop_clearway',
    sourceName: 'Bracknell Forest TRO (Bus Stop Clearway Filter)',
    authorityName: 'Bracknell Forest Council',
    datasetUrl:
      'https://services9.arcgis.com/5eO9hmsd8SoBl0Cj/arcgis/rest/services/GIS_TrafficRegulationOrder/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson',
    hazardType: 'bus_stop',
    priority: 94,
    confidence: 0.97,
    includeRegex: '\\bbus\\s*stop\\s*clearway\\b',
    includeFields: ['TROTYPE', 'CategoryHighway', 'CategoryBFH'],
    labelFields: ['TROTYPE', 'CategoryHighway', 'MAPREF'],
  },
  {
    id: 'leicester_bus_lane_enforcement_points',
    sourceName: 'Leicester Bus Lane Enforcement Points',
    authorityName: 'Leicester City Council',
    datasetUrl:
      'https://data.leicester.gov.uk/api/explore/v2.1/catalog/datasets/enforcement-points/exports/geojson',
    hazardType: 'speed_camera',
    priority: 90,
    confidence: 0.9,
    includeAll: true,
    labelFields: ['site'],
  },
  {
    id: 'dudley_tro_bus_stop_filtered',
    sourceName: 'Dudley TRO (Bus Stop Filter, WFS)',
    authorityName: 'Dudley Metropolitan Borough Council',
    datasetUrl:
      'https://maps.dudley.gov.uk/getows.ashx?mapsource=mapsources/inspire&service=WFS&language=English&request=GetFeature&typename=traffic_orders&version=1.1.0&maxfeatures=50000',
    datasetFormat: 'wfs_gml',
    hazardType: 'bus_stop',
    priority: 94,
    confidence: 0.97,
    includeRegex: '\\b(bus\\s*stop|clearway)\\b',
    includeFields: ['description', 'road_name', 'order_num'],
    labelFields: ['road_name', 'description', 'order_num'],
  },
];

function parseArgs(argv: string[]): ParsedArgs {
  const apply = argv.includes('--apply');
  const allowEmptySync = argv.includes('--allow-empty-sync');

  const sourceArg = argv.find((arg) => arg.startsWith('--source='));
  const sourceIds = sourceArg
    ? new Set(
        sourceArg
          .replace('--source=', '')
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      )
    : null;

  const ttlDays = clampInt(readNumberArg(argv, '--ttl-days', 30), 1, 365);
  const timeoutMs = clampInt(readNumberArg(argv, '--timeout-ms', 35_000), 5000, 120_000);
  const maxFeaturesPerSource = clampInt(
    readNumberArg(argv, '--max-features', 100_000),
    1,
    500_000,
  );

  return {
    apply,
    sourceIds,
    allowEmptySync,
    ttlDays,
    timeoutMs,
    maxFeaturesPerSource,
  };
}

function readNumberArg(argv: string[], name: string, fallback: number): number {
  const match = argv.find((arg) => arg.startsWith(`${name}=`));
  if (!match) return fallback;
  const parsed = Number(match.slice(name.length + 1));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toStringSafe(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function normalizeLabel(
  props: Record<string, unknown>,
  labelFields: string[] | undefined,
  fallback: string,
): string {
  for (const field of labelFields ?? []) {
    const value = toStringSafe(props[field]);
    if (value.length > 0) return value;
  }
  return fallback;
}

function parseDateOrNull(value: unknown): string | null {
  const raw = toStringSafe(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function shouldIncludeFeature(
  source: TroSourceConfig,
  props: Record<string, unknown>,
): boolean {
  if (source.includeAll) return true;
  const regex = source.includeRegex ? new RegExp(source.includeRegex, 'i') : null;
  if (!regex) return true;
  const includeFields = source.includeFields ?? Object.keys(props);
  const payload = includeFields.map((field) => toStringSafe(props[field])).join(' | ');
  return regex.test(payload);
}

function isGeometryUsable(geometry: GeoJSONGeometry | undefined): geometry is Exclude<GeoJSONGeometry, null> {
  if (!geometry || typeof geometry !== 'object') return false;
  const kind = toStringSafe((geometry as { type?: unknown }).type);
  return kind.length > 0;
}

function buildFeatureId(
  source: TroSourceConfig,
  feature: GeoJSONFeature,
  props: Record<string, unknown>,
): string {
  const stableRef =
    toStringSafe(feature.id) ||
    toStringSafe(props.GmlID) ||
    toStringSafe(props.OBJECTID) ||
    toStringSafe(props.ORDER_REF) ||
    toStringSafe(props.LegislationRef);
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        sourceId: source.id,
        stableRef,
        geometry: feature.geometry,
      }),
    )
    .digest('hex')
    .slice(0, 32);
  return `${source.id}:${digest}`;
}

function normalizeCollection(data: unknown): GeoJSONCollection {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as GeoJSONCollection;
    } catch {
      return {};
    }
  }
  if (data && typeof data === 'object') {
    return data as GeoJSONCollection;
  }
  return {};
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function stripNamespace(name: string): string {
  const idx = name.indexOf(':');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function parseSrid(value: unknown): number | null {
  const raw = toStringSafe(value);
  if (!raw) return null;
  const match = raw.match(/EPSG[:/](\d+)/i) ?? raw.match(/(\d{4,6})/);
  if (!match) return null;
  const srid = Number(match[1]);
  return Number.isFinite(srid) ? srid : null;
}

function parsePosPairs(value: unknown): number[][] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const textLike = record['#text'] ?? record.text ?? record.value;
    if (textLike != null) {
      return parsePosPairs(textLike);
    }
  }
  const text = toStringSafe(value);
  if (!text) return [];
  const tokens = text
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
  const pairs: number[][] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    pairs.push([tokens[i], tokens[i + 1]]);
  }
  return pairs;
}

function readRing(node: unknown): number[][] {
  if (!node || typeof node !== 'object') return [];
  const record = node as Record<string, unknown>;
  const linearRing = (record['gml:LinearRing'] ?? record.LinearRing ?? record) as Record<
    string,
    unknown
  >;

  const fromPosList = parsePosPairs(linearRing['gml:posList'] ?? linearRing.posList);
  if (fromPosList.length > 0) return fromPosList;

  const posNodes = toArray(linearRing['gml:pos'] ?? linearRing.pos);
  const fromPosNodes = posNodes.flatMap((posNode) => parsePosPairs(posNode));
  if (fromPosNodes.length > 0) return fromPosNodes;

  return parsePosPairs(linearRing['gml:coordinates'] ?? linearRing.coordinates);
}

function readPolygonCoordinates(node: unknown): number[][][] {
  if (!node || typeof node !== 'object') return [];
  const record = node as Record<string, unknown>;
  const exteriorNodes = toArray(record['gml:exterior'] ?? record.exterior);
  const interiorNodes = toArray(record['gml:interior'] ?? record.interior);
  const rings = [
    ...exteriorNodes.map((ringNode) => readRing(ringNode)),
    ...interiorNodes.map((ringNode) => readRing(ringNode)),
  ].filter((ring) => ring.length >= 4);
  return rings;
}

function readLineCoordinates(node: unknown): number[][] {
  if (!node || typeof node !== 'object') return [];
  const record = node as Record<string, unknown>;
  const fromPosList = parsePosPairs(record['gml:posList'] ?? record.posList);
  if (fromPosList.length > 0) return fromPosList;
  const posNodes = toArray(record['gml:pos'] ?? record.pos);
  return posNodes.flatMap((posNode) => parsePosPairs(posNode));
}

function readPointCoordinates(node: unknown): number[] {
  if (!node || typeof node !== 'object') return [];
  const record = node as Record<string, unknown>;
  const pairs = parsePosPairs(record['gml:pos'] ?? record.pos ?? record['gml:coordinates']);
  return pairs[0] ?? [];
}

function readGeometryFromGml(node: unknown): {
  geometry: GeoJSONGeometry;
  sourceSrid: number | null;
} {
  if (!node || typeof node !== 'object') {
    return { geometry: null, sourceSrid: null };
  }

  const container = node as Record<string, unknown>;
  const geometryEntry = Object.entries(container).find(([key, value]) => {
    if (!value || typeof value !== 'object') return false;
    return key.startsWith('gml:');
  });
  if (!geometryEntry) {
    return { geometry: null, sourceSrid: null };
  }

  const [gmlType, gmlNodeRaw] = geometryEntry;
  const gmlNode = gmlNodeRaw as Record<string, unknown>;
  const sourceSrid = parseSrid(gmlNode.srsName) ?? null;
  const type = stripNamespace(gmlType);

  if (type === 'Polygon') {
    const coordinates = readPolygonCoordinates(gmlNode);
    return {
      geometry:
        coordinates.length > 0
          ? ({
              type: 'Polygon',
              coordinates,
            } as GeoJSONGeometry)
          : null,
      sourceSrid,
    };
  }

  if (type === 'MultiPolygon') {
    const members = toArray(gmlNode['gml:polygonMember'] ?? gmlNode.polygonMember);
    const coordinates = members
      .map((member) => {
        const memberRecord = member as Record<string, unknown>;
        const polygonNode = (memberRecord['gml:Polygon'] ??
          memberRecord.Polygon) as Record<string, unknown> | undefined;
        return readPolygonCoordinates(polygonNode);
      })
      .filter((poly) => poly.length > 0);
    return {
      geometry:
        coordinates.length > 0
          ? ({
              type: 'MultiPolygon',
              coordinates,
            } as GeoJSONGeometry)
          : null,
      sourceSrid,
    };
  }

  if (type === 'LineString') {
    const coordinates = readLineCoordinates(gmlNode);
    return {
      geometry:
        coordinates.length >= 2
          ? ({
              type: 'LineString',
              coordinates,
            } as GeoJSONGeometry)
          : null,
      sourceSrid,
    };
  }

  if (type === 'MultiLineString') {
    const members = toArray(gmlNode['gml:lineStringMember'] ?? gmlNode.lineStringMember);
    const coordinates = members
      .map((member) => {
        const memberRecord = member as Record<string, unknown>;
        const lineNode = (memberRecord['gml:LineString'] ??
          memberRecord.LineString) as Record<string, unknown> | undefined;
        return readLineCoordinates(lineNode);
      })
      .filter((line) => line.length >= 2);
    return {
      geometry:
        coordinates.length > 0
          ? ({
              type: 'MultiLineString',
              coordinates,
            } as GeoJSONGeometry)
          : null,
      sourceSrid,
    };
  }

  if (type === 'Point') {
    const coordinates = readPointCoordinates(gmlNode);
    return {
      geometry:
        coordinates.length >= 2
          ? ({
              type: 'Point',
              coordinates,
            } as GeoJSONGeometry)
          : null,
      sourceSrid,
    };
  }

  return { geometry: null, sourceSrid };
}

function parseWfsGmlToCollection(xml: string): GeoJSONCollection {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
    parseTagValue: false,
  });
  const root = parser.parse(xml) as Record<string, unknown>;
  const featureCollection = (root['wfs:FeatureCollection'] ??
    root.FeatureCollection) as Record<string, unknown> | undefined;
  if (!featureCollection) {
    return { type: 'FeatureCollection', features: [] };
  }

  const featureMembers = toArray(
    featureCollection['gml:featureMember'] ?? featureCollection.featureMember,
  );

  const features: GeoJSONFeature[] = [];
  for (const featureMember of featureMembers) {
    if (!featureMember || typeof featureMember !== 'object') continue;
    const memberRecord = featureMember as Record<string, unknown>;
    const featureEntry = Object.entries(memberRecord).find(
      ([key]) => key !== 'gml:boundedBy' && key !== 'boundedBy',
    );
    if (!featureEntry) continue;

    const [, featureNodeRaw] = featureEntry;
    if (!featureNodeRaw || typeof featureNodeRaw !== 'object') continue;
    const featureNode = featureNodeRaw as Record<string, unknown>;

    let featureId = toStringSafe(featureNode['gml:id'] ?? featureNode.id);
    let geometry: GeoJSONGeometry = null;
    let sourceSrid: number | null = null;
    const properties: Record<string, unknown> = {};

    for (const [rawKey, rawValue] of Object.entries(featureNode)) {
      const key = stripNamespace(rawKey);
      if (rawKey === 'gml:id' || rawKey === 'id') {
        featureId = toStringSafe(rawValue);
        continue;
      }
      if (rawKey === 'gml:boundedBy' || rawKey === 'boundedBy') {
        continue;
      }

      const record = rawValue as Record<string, unknown>;
      const containsGmlGeometry =
        rawValue &&
        typeof rawValue === 'object' &&
        Object.keys(record).some((childKey) => childKey.startsWith('gml:'));

      if (containsGmlGeometry) {
        const parsedGeometry = readGeometryFromGml(record);
        geometry = parsedGeometry.geometry;
        sourceSrid = parsedGeometry.sourceSrid;
        continue;
      }

      if (rawValue == null) {
        properties[key] = null;
      } else if (
        typeof rawValue === 'string' ||
        typeof rawValue === 'number' ||
        typeof rawValue === 'boolean'
      ) {
        properties[key] = rawValue;
      } else {
        properties[key] = toStringSafe(rawValue);
      }
    }

    features.push({
      type: 'Feature',
      id: featureId || undefined,
      geometry,
      properties,
      _sourceSrid: sourceSrid ?? undefined,
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

async function fetchGeoJson(
  url: string,
  timeoutMs: number,
): Promise<GeoJSONCollection> {
  const response = await axios.get(url, {
    timeout: timeoutMs,
    maxRedirects: 10,
    responseType: 'json',
    headers: {
      'User-Agent': 'Drivest-TRO-Importer/1.0 (+https://drivest.uk)',
      Accept: 'application/json,application/geo+json,text/plain,*/*',
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return normalizeCollection(response.data);
}

async function fetchWfsGml(
  url: string,
  timeoutMs: number,
): Promise<GeoJSONCollection> {
  const response = await axios.get(url, {
    timeout: timeoutMs,
    maxRedirects: 10,
    responseType: 'text',
    headers: {
      'User-Agent': 'Drivest-TRO-Importer/1.0 (+https://drivest.uk)',
      Accept: 'application/xml,text/xml,*/*',
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return parseWfsGmlToCollection(String(response.data ?? ''));
}

async function fetchSourceCollection(
  source: TroSourceConfig,
  timeoutMs: number,
): Promise<GeoJSONCollection> {
  if (source.datasetFormat === 'wfs_gml') {
    return fetchWfsGml(source.datasetUrl, timeoutMs);
  }
  return fetchGeoJson(source.datasetUrl, timeoutMs);
}

async function upsertFeatureRow(input: {
  id: string;
  source: TroSourceConfig;
  geometryJson: string;
  sourceSrid: number;
  properties: Record<string, unknown>;
  label: string;
  validFrom: string | null;
  validTo: string | null;
  expiresAt: string | null;
}) {
  await dataSource.query(
    `
      INSERT INTO council_tro_features (
        id,
        source_id,
        source_name,
        authority_name,
        dataset_url,
        hazard_type,
        label,
        geom,
        feature_point,
        properties,
        priority,
        confidence,
        valid_from,
        valid_to,
        fetched_at,
        expires_at,
        is_active,
        metadata,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        ST_Transform(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($8), $16)), 4326),
        ST_PointOnSurface(ST_Transform(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($8), $16)), 4326)),
        $9::jsonb,
        $10,
        $11,
        $12::timestamptz,
        $13::timestamptz,
        now(),
        $14::timestamptz,
        true,
        $15::jsonb,
        now()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        source_id = EXCLUDED.source_id,
        source_name = EXCLUDED.source_name,
        authority_name = EXCLUDED.authority_name,
        dataset_url = EXCLUDED.dataset_url,
        hazard_type = EXCLUDED.hazard_type,
        label = EXCLUDED.label,
        geom = EXCLUDED.geom,
        feature_point = EXCLUDED.feature_point,
        properties = EXCLUDED.properties,
        priority = EXCLUDED.priority,
        confidence = EXCLUDED.confidence,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        fetched_at = now(),
        expires_at = EXCLUDED.expires_at,
        is_active = true,
        metadata = EXCLUDED.metadata,
        updated_at = now()
    `,
    [
      input.id,
      input.source.id,
      input.source.sourceName,
      input.source.authorityName,
      input.source.datasetUrl,
      input.source.hazardType,
      input.label,
      input.geometryJson,
      JSON.stringify(input.properties ?? {}),
      input.source.priority,
      input.source.confidence,
      input.validFrom,
      input.validTo,
      input.expiresAt,
      JSON.stringify({
        importer: 'import-council-tro.ts',
      }),
      input.sourceSrid,
    ],
  );
}

async function syncSource(source: TroSourceConfig, args: ParsedArgs) {
  const expiresAt = new Date(
    Date.now() + args.ttlDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const payload = await fetchSourceCollection(source, args.timeoutMs);
  const allFeatures = Array.isArray(payload.features) ? payload.features : [];
  const limitedFeatures = allFeatures.slice(0, args.maxFeaturesPerSource);

  let accepted = 0;
  let written = 0;
  let skippedInvalidGeometry = 0;
  const seenIds: string[] = [];

  if (args.apply) {
    await dataSource.query('BEGIN');
  }

  try {
    for (const feature of limitedFeatures) {
      const props = toRecord(feature.properties);
      if (!shouldIncludeFeature(source, props)) {
        continue;
      }

      if (!isGeometryUsable(feature.geometry)) {
        skippedInvalidGeometry += 1;
        continue;
      }

      const id = buildFeatureId(source, feature, props);
      const label = normalizeLabel(props, source.labelFields, source.sourceName);
      const validFrom =
        parseDateOrNull(props.valid_from) ??
        parseDateOrNull(props.start_date) ??
        parseDateOrNull(props.date_operational) ??
        parseDateOrNull(props.SHOWHIDE) ??
        parseDateOrNull(props.Date);
      const validTo =
        parseDateOrNull(props.valid_to) ??
        parseDateOrNull(props.end_date) ??
        parseDateOrNull(props.date_revoked) ??
        parseDateOrNull(props.date_suspended) ??
        parseDateOrNull(props.SHOWHIDE1);

      accepted += 1;
      seenIds.push(id);

      if (!args.apply) {
        continue;
      }

      await upsertFeatureRow({
        id,
        source,
        geometryJson: JSON.stringify(feature.geometry),
        sourceSrid: feature._sourceSrid ?? 4326,
        properties: props,
        label,
        validFrom,
        validTo,
        expiresAt,
      });
      written += 1;
    }

    if (args.apply && (seenIds.length > 0 || args.allowEmptySync)) {
      if (seenIds.length > 0) {
        await dataSource.query(
          `
            UPDATE council_tro_features
            SET is_active = false, updated_at = now()
            WHERE source_id = $1
              AND NOT (id = ANY($2::text[]))
          `,
          [source.id, seenIds],
        );
      } else {
        await dataSource.query(
          `
            UPDATE council_tro_features
            SET is_active = false, updated_at = now()
            WHERE source_id = $1
          `,
          [source.id],
        );
      }
    }

    if (args.apply) {
      await dataSource.query('COMMIT');
    }

    return {
      sourceId: source.id,
      fetched: allFeatures.length,
      scanned: limitedFeatures.length,
      accepted,
      written,
      skippedInvalidGeometry,
    };
  } catch (error) {
    if (args.apply) {
      await dataSource.query('ROLLBACK');
    }
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selectedSources = FREE_TRO_SOURCES.filter(
    (source) => !args.sourceIds || args.sourceIds.has(source.id),
  );

  if (selectedSources.length === 0) {
    console.log('No matching TRO sources selected. Nothing to do.');
    return;
  }

  await dataSource.initialize();
  try {
    const summaries: Array<Record<string, unknown>> = [];
    for (const source of selectedSources) {
      const summary = await syncSource(source, args);
      summaries.push(summary);
      console.log(
        `[TRO] source=${source.id} fetched=${summary.fetched} scanned=${summary.scanned} accepted=${summary.accepted} written=${summary.written} skipped_invalid_geometry=${summary.skippedInvalidGeometry}`,
      );
    }

    console.log(
      `[TRO] complete mode=${args.apply ? 'apply' : 'dry-run'} sources=${selectedSources.length}`,
    );
    console.log(JSON.stringify({ summaries }, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error('[TRO] import failed:', message);
  process.exit(1);
});
