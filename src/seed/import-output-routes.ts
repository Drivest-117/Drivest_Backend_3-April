import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { In } from 'typeorm';
import dataSource from '../database/typeorm.config';
import { Product, ProductPeriod, ProductType } from '../entities/product.entity';
import { Route, RouteDifficulty } from '../entities/route.entity';
import { TestCentre } from '../entities/test-centre.entity';

type CoordinatePoint = [number, number];

type RoutesMetadata = {
  generatedAt?: string;
  centreId?: string;
  centreName?: string;
};

type OutputRoute = {
  id?: string;
  name?: string;
  centreId?: string;
  centreName?: string;
  centreCoordinates?: {
    lat?: number;
    lon?: number;
    lng?: number;
  };
  distanceMeters?: number;
  distanceM?: number;
  durationS?: number;
  estimatedDurationSeconds?: number;
  difficultyLevel?: string;
  coordinates?: unknown[];
  sourceFile?: string;
  sourceFormat?: string;
  sourcePdfName?: string;
  roadsUsed?: unknown;
  routeFamily?: unknown;
  routeZones?: unknown;
  validationFlags?: unknown;
  qualityScore?: unknown;
};

type OutputRoutesDocument = {
  metadata?: RoutesMetadata;
  routes?: OutputRoute[];
};

type CentreVerificationDocument = {
  resolved?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  centre_json?: {
    lat?: number;
    lng?: number;
  };
  excel?: {
    name?: string;
    address?: string;
    postcode?: string;
  };
};

type CliOptions = {
  rootDir: string;
  dryRun: boolean;
  syncProducts: boolean;
  deactivateMissing: boolean;
  strictCentreCoords: boolean;
  centreFilters: string[];
  coordinatesSource: 'json' | 'gpx' | 'auto';
};

type ImportStats = {
  scannedCentres: number;
  importedCentres: number;
  skippedCentres: number;
  importedRoutes: number;
  updatedRoutes: number;
  deactivatedRoutes: number;
  skippedRoutes: number;
  productsCreated: number;
  productsUpdated: number;
};

const DEFAULT_ROOT_DIR = '/Users/drivest/Desktop/output';
const UK_POSTCODE_REGEX = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
const GPX_TRACKPOINT_REGEX = /<trkpt[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"/gi;

type GpxManifestEntry = {
  id?: string;
  name?: string;
  file?: string;
  distanceMeters?: number;
  estimatedDurationSeconds?: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    rootDir: process.env.ROUTES_OUTPUT_ROOT || DEFAULT_ROOT_DIR,
    dryRun: false,
    syncProducts: true,
    deactivateMissing: true,
    strictCentreCoords: false,
    centreFilters: [],
    coordinatesSource: 'json',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--skip-products') {
      options.syncProducts = false;
      continue;
    }
    if (arg === '--keep-missing-active') {
      options.deactivateMissing = false;
      continue;
    }
    if (arg === '--strict-centre-coords') {
      options.strictCentreCoords = true;
      continue;
    }
    if (arg === '--root' && argv[i + 1]) {
      options.rootDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--root=')) {
      options.rootDir = arg.slice('--root='.length);
      continue;
    }
    if (arg === '--centre' && argv[i + 1]) {
      options.centreFilters.push(slugify(argv[i + 1]));
      i += 1;
      continue;
    }
    if (arg.startsWith('--centre=')) {
      options.centreFilters.push(slugify(arg.slice('--centre='.length)));
      continue;
    }
    if (arg === '--coordinates-source' && argv[i + 1]) {
      const value = String(argv[i + 1]).trim().toLowerCase();
      if (value === 'json' || value === 'gpx' || value === 'auto') {
        options.coordinatesSource = value;
      } else {
        throw new Error(`Unsupported --coordinates-source value: ${argv[i + 1]}`);
      }
      i += 1;
      continue;
    }
    if (arg.startsWith('--coordinates-source=')) {
      const value = String(arg.slice('--coordinates-source='.length)).trim().toLowerCase();
      if (value === 'json' || value === 'gpx' || value === 'auto') {
        options.coordinatesSource = value;
      } else {
        throw new Error(`Unsupported --coordinates-source value: ${value}`);
      }
      continue;
    }
  }

  options.centreFilters = Array.from(new Set(options.centreFilters.filter(Boolean)));
  return options;
}

function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]+/g)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function slugify(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function routeProductSlug(centreSlug: string): string {
  return centreSlug.replace(/-/g, '_');
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function dedupeConsecutive(points: CoordinatePoint[]): CoordinatePoint[] {
  const deduped: CoordinatePoint[] = [];
  for (const point of points) {
    const last = deduped[deduped.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) {
      deduped.push(point);
    }
  }
  return deduped;
}

function normalizeCoordinates(raw: unknown): CoordinatePoint[] {
  if (!Array.isArray(raw)) return [];

  const parsed: CoordinatePoint[] = [];
  for (const item of raw) {
    if (Array.isArray(item) && item.length >= 2) {
      const lon = toNumber(item[0]);
      const lat = toNumber(item[1]);
      if (lon != null && lat != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        parsed.push([lon, lat]);
      }
      continue;
    }

    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const lat = toNumber(obj.lat);
      const lon = toNumber(obj.lon ?? obj.lng);
      if (lon != null && lat != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        parsed.push([lon, lat]);
      }
    }
  }

  return dedupeConsecutive(parsed);
}

function haversineMeters(a: CoordinatePoint, b: CoordinatePoint): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const q =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 6371000 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function computeDistanceMeters(coords: CoordinatePoint[]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    total += haversineMeters(coords[i], coords[i + 1]);
  }
  return Math.max(1, Math.round(total));
}

function computeDurationSeconds(distanceM: number): number {
  const estimated = Math.round((Math.max(distanceM, 1) / 1000) * 120);
  return Math.max(60, estimated);
}

function computeBbox(coords: CoordinatePoint[]): [number, number, number, number] {
  let minLon = 180;
  let minLat = 90;
  let maxLon = -180;
  let maxLat = -90;

  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }

  return [minLon, minLat, maxLon, maxLat];
}

function mapDifficulty(raw: string | undefined): RouteDifficulty {
  const normalized = String(raw || '').trim().toUpperCase();
  if (normalized === 'EASY') return RouteDifficulty.EASY;
  if (normalized === 'HARD') return RouteDifficulty.HARD;
  return RouteDifficulty.MEDIUM;
}

function extractPostcode(address: string): string | null {
  const match = address.match(UK_POSTCODE_REGEX);
  return match ? match[0].toUpperCase().replace(/\s+/g, ' ').trim() : null;
}

function parseCentroidFromRoutes(routes: OutputRoute[]): { lat: number; lng: number } | null {
  if (!routes.length) return null;

  for (const route of routes) {
    const lat = toNumber(route.centreCoordinates?.lat);
    const lng = toNumber(route.centreCoordinates?.lon ?? route.centreCoordinates?.lng);
    if (lat != null && lng != null) {
      return { lat, lng };
    }
  }

  for (const route of routes) {
    const coords = normalizeCoordinates(route.coordinates);
    if (coords.length > 0) {
      return { lat: coords[0][1], lng: coords[0][0] };
    }
  }

  return null;
}

function readOptionalGpx(centreDir: string, sourceFile: string | undefined): string | null {
  if (!sourceFile || !sourceFile.toLowerCase().endsWith('.gpx')) return null;
  const candidates = [
    path.join(centreDir, 'gpx', sourceFile),
    path.join(centreDir, sourceFile),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return fs.readFileSync(candidate, 'utf8');
    } catch {
      return null;
    }
  }

  return null;
}

function parseCoordinatesFromGpx(gpx: string | null): CoordinatePoint[] {
  if (!gpx) return [];
  const points: CoordinatePoint[] = [];
  let match: RegExpExecArray | null;
  while ((match = GPX_TRACKPOINT_REGEX.exec(gpx)) !== null) {
    const lat = toNumber(match[1]);
    const lon = toNumber(match[2]);
    if (lat == null || lon == null) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    points.push([lon, lat]);
  }
  return dedupeConsecutive(points);
}

function readGpxManifest(centreDir: string): GpxManifestEntry[] {
  const manifestPath = path.join(centreDir, 'gpx', 'manifest.json');
  const manifest = readJsonFile<GpxManifestEntry[]>(manifestPath);
  return Array.isArray(manifest) ? manifest : [];
}

function findGpxFileNameForRoute(
  route: OutputRoute,
  externalRouteId: string,
  gpxManifestEntries: GpxManifestEntry[],
): string | undefined {
  if (route.sourceFile && route.sourceFile.toLowerCase().endsWith('.gpx')) {
    return route.sourceFile;
  }

  const byId = gpxManifestEntries.find((entry) => slugify(entry.id || '') === slugify(externalRouteId));
  if (byId?.file) return byId.file;

  const routeName = ensureNonEmpty(route.name, '');
  const byName = gpxManifestEntries.find((entry) => slugify(entry.name || '') === slugify(routeName));
  if (byName?.file) return byName.file;

  return undefined;
}

function selectCoordinates(
  options: CliOptions,
  gpxCoordinates: CoordinatePoint[],
  jsonCoordinates: CoordinatePoint[],
): CoordinatePoint[] {
  if (options.coordinatesSource === 'gpx') {
    return gpxCoordinates.length >= 2 ? gpxCoordinates : jsonCoordinates;
  }
  if (options.coordinatesSource === 'auto') {
    return gpxCoordinates.length >= 2 ? gpxCoordinates : jsonCoordinates;
  }
  return jsonCoordinates.length >= 2 ? jsonCoordinates : gpxCoordinates;
}

function buildRoutePayload(route: OutputRoute, metadata: RoutesMetadata | undefined): Record<string, unknown> {
  return {
    source: 'desktop_output_v1',
    sourceRouteId: route.id ?? null,
    sourceFile: route.sourceFile ?? null,
    sourceFormat: route.sourceFormat ?? null,
    sourcePdfName: route.sourcePdfName ?? null,
    routeFamily: route.routeFamily ?? null,
    routeZones: route.routeZones ?? null,
    roadsUsed: route.roadsUsed ?? null,
    validationFlags: route.validationFlags ?? null,
    qualityScore: route.qualityScore ?? null,
    generatedAt: metadata?.generatedAt ?? null,
  };
}

function routeGeoJson(name: string, coords: CoordinatePoint[]): Record<string, unknown> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name,
        },
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      },
    ],
  };
}

async function upsertCentre(
  repo: ReturnType<typeof dataSource.getRepository<TestCentre>>,
  centreSlug: string,
  centreName: string,
  address: string,
  postcode: string,
  city: string,
  country: string,
  lat: number,
  lng: number,
  dryRun: boolean,
): Promise<TestCentre> {
  const existing = await repo
    .createQueryBuilder('centre')
    .where('centre.slug = :slug', { slug: centreSlug })
    .getOne();

  if (existing) {
    if (dryRun) {
      return {
        ...existing,
        name: centreName,
        slug: centreSlug,
        address,
        postcode,
        city,
        country,
        lat,
        lng,
      };
    }

    const updatedRows = await repo.query(
      `UPDATE test_centres
          SET name = $1,
              slug = $2,
              address = $3,
              postcode = $4,
              city = $5,
              country = $6,
              lat = $7,
              lng = $8,
              geo = ST_SetSRID(ST_MakePoint($8, $7), 4326)
        WHERE id = $9
      RETURNING *`,
      [
        centreName,
        centreSlug,
        address,
        postcode,
        city,
        country,
        lat,
        lng,
        existing.id,
      ],
    );
    return updatedRows[0] as TestCentre;
  }

  if (dryRun) {
    return repo.create({
      id: `dry-${centreSlug}`,
      name: centreName,
      slug: centreSlug,
      address,
      postcode,
      city,
      country,
      lat,
      lng,
      geo: `POINT(${lng} ${lat})`,
      routes: [],
    });
  }

  const insertedRows = await repo.query(
    `INSERT INTO test_centres (name, slug, address, postcode, city, country, lat, lng, geo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($8, $7), 4326))
     RETURNING *`,
    [centreName, centreSlug, address, postcode, city, country, lat, lng],
  );

  return insertedRows[0] as TestCentre;
}

type DesiredProduct = {
  type: ProductType;
  pricePence: number;
  period: ProductPeriod;
  iosProductId: string;
  androidProductId: string;
};

function desiredProductsForCentre(centreSlug: string): DesiredProduct[] {
  const productSlug = routeProductSlug(centreSlug);
  return [
    {
      type: ProductType.CENTRE_PACK,
      pricePence: 1000,
      period: ProductPeriod.NONE,
      iosProductId: `centre_${productSlug}_ios`,
      androidProductId: `centre_${productSlug}_android`,
    },
    {
      type: ProductType.SUBSCRIPTION,
      pricePence: 1000,
      period: ProductPeriod.WEEK,
      iosProductId: `centre_${productSlug}_week_ios`,
      androidProductId: `centre_${productSlug}_week_android`,
    },
    {
      type: ProductType.SUBSCRIPTION,
      pricePence: 2900,
      period: ProductPeriod.MONTH,
      iosProductId: `centre_${productSlug}_month_ios`,
      androidProductId: `centre_${productSlug}_month_android`,
    },
    {
      type: ProductType.SUBSCRIPTION,
      pricePence: 4900,
      period: ProductPeriod.QUARTER,
      iosProductId: `centre_${productSlug}_quarter_ios`,
      androidProductId: `centre_${productSlug}_quarter_android`,
    },
  ];
}

async function syncCentreProducts(
  productRepo: ReturnType<typeof dataSource.getRepository<Product>>,
  centre: TestCentre,
  dryRun: boolean,
): Promise<{ created: number; updated: number }> {
  const centreSlug = centre.slug || slugify(centre.name) || `centre-${centre.id}`;
  const desired = desiredProductsForCentre(centreSlug);
  const iosIds = desired.map((item) => item.iosProductId);
  const existing = await productRepo.find({ where: { iosProductId: In(iosIds) } });
  const byIosId = new Map(existing.map((item) => [item.iosProductId, item]));

  const toPersist: Product[] = [];
  let created = 0;
  let updated = 0;

  for (const item of desired) {
    const found = byIosId.get(item.iosProductId);
    if (!found) {
      created += 1;
      if (!dryRun) {
        toPersist.push(
          productRepo.create({
            type: item.type,
            pricePence: item.pricePence,
            period: item.period,
            iosProductId: item.iosProductId,
            androidProductId: item.androidProductId,
            active: true,
            metadata: { centreId: centre.id, scope: 'CENTRE' },
          }),
        );
      }
      continue;
    }

    const existingCentreId =
      found.metadata && typeof found.metadata === 'object'
        ? (found.metadata as Record<string, unknown>).centreId
        : null;
    const metadataMismatch = existingCentreId !== centre.id;
    const shapeMismatch =
      found.type !== item.type ||
      found.period !== item.period ||
      found.pricePence !== item.pricePence ||
      found.androidProductId !== item.androidProductId ||
      found.active !== true;

    if (metadataMismatch || shapeMismatch) {
      updated += 1;
      if (!dryRun) {
        found.type = item.type;
        found.period = item.period;
        found.pricePence = item.pricePence;
        found.androidProductId = item.androidProductId;
        found.active = true;
        found.metadata = { centreId: centre.id, scope: 'CENTRE' };
        toPersist.push(found);
      }
    }
  }

  if (toPersist.length > 0 && !dryRun) {
    await productRepo.save(toPersist);
  }

  return { created, updated };
}

function ensureNonEmpty(value: string | undefined, fallback: string): string {
  const trimmed = String(value || '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function routeNameKey(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.rootDir)) {
    throw new Error(`Routes output root does not exist: ${options.rootDir}`);
  }

  const stats: ImportStats = {
    scannedCentres: 0,
    importedCentres: 0,
    skippedCentres: 0,
    importedRoutes: 0,
    updatedRoutes: 0,
    deactivatedRoutes: 0,
    skippedRoutes: 0,
    productsCreated: 0,
    productsUpdated: 0,
  };

  await dataSource.initialize();

  const centreRepo = dataSource.getRepository(TestCentre);
  const routeRepo = dataSource.getRepository(Route);
  const productRepo = dataSource.getRepository(Product);

  const centreDirs = fs
    .readdirSync(options.rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      if (!options.centreFilters.length) return true;
      const slug = slugify(name);
      return options.centreFilters.includes(slug);
    })
    .sort();

  for (const centreFolderName of centreDirs) {
    stats.scannedCentres += 1;
    const centreDir = path.join(options.rootDir, centreFolderName);
    const routesPath = path.join(centreDir, 'routes.json');
    const verificationPath = path.join(centreDir, 'centre_verification.json');
    const gpxManifestEntries = readGpxManifest(centreDir);

    const routesDoc = readJsonFile<OutputRoutesDocument>(routesPath);
    const routes = Array.isArray(routesDoc?.routes) ? routesDoc?.routes || [] : [];
    if (!routesDoc || routes.length === 0) {
      stats.skippedCentres += 1;
      console.warn(`[seed-output] skip centre=${centreFolderName} reason=no-routes-json-or-empty`);
      continue;
    }

    const verification = readJsonFile<CentreVerificationDocument>(verificationPath);
    const centreSlug = slugify(centreFolderName);
    const fallbackCentreName = titleFromSlug(centreSlug);

    const metadata = routesDoc.metadata;
    const centreName = ensureNonEmpty(
      verification?.excel?.name || metadata?.centreName || routes[0]?.centreName,
      fallbackCentreName,
    );

    const coordsFromRoutes = parseCentroidFromRoutes(routes);
    const lat =
      toNumber(verification?.resolved?.lat) ??
      toNumber(verification?.centre_json?.lat) ??
      coordsFromRoutes?.lat ??
      null;
    const lng =
      toNumber(verification?.resolved?.lng) ??
      toNumber(verification?.centre_json?.lng) ??
      coordsFromRoutes?.lng ??
      null;

    if (lat == null || lng == null) {
      if (options.strictCentreCoords) {
        throw new Error(`Centre ${centreFolderName} has no coordinates and strict mode is enabled`);
      }
      stats.skippedCentres += 1;
      console.warn(`[seed-output] skip centre=${centreFolderName} reason=missing-centre-coordinates`);
      continue;
    }

    const address = ensureNonEmpty(
      verification?.resolved?.address || verification?.excel?.address,
      `${centreName} Test Centre`,
    );
    const postcode = ensureNonEmpty(
      verification?.excel?.postcode || extractPostcode(address) || undefined,
      'UNKNOWN',
    );
    const city = ensureNonEmpty(metadata?.centreName, fallbackCentreName);
    const country = 'UK';

    const centre = await upsertCentre(
      centreRepo,
      centreSlug,
      centreName,
      address,
      postcode,
      city,
      country,
      lat,
      lng,
      options.dryRun,
    );

    stats.importedCentres += 1;

    const existingRoutes = options.dryRun
      ? []
      : await routeRepo.find({ where: { centreId: centre.id } });

    const existingByExternalId = new Map<string, Route>();
    const existingByName = new Map<string, Route>();
    for (const existingRoute of existingRoutes) {
      if (existingRoute.externalRouteId) {
        existingByExternalId.set(existingRoute.externalRouteId, existingRoute);
      }
      const key = routeNameKey(existingRoute.name);
      if (key) {
        existingByName.set(key, existingRoute);
      }
    }

    const importedExternalIds = new Set<string>();

    for (const routeRow of routes) {
      const routeName = ensureNonEmpty(routeRow.name, 'Practice Route');
      const externalRouteId = ensureNonEmpty(routeRow.id, `${centreSlug}-${slugify(routeName)}`);
      const gpxSourceFile = findGpxFileNameForRoute(routeRow, externalRouteId, gpxManifestEntries);
      const gpx = readOptionalGpx(centreDir, gpxSourceFile);
      const gpxCoordinates = parseCoordinatesFromGpx(gpx);
      const jsonCoordinates = normalizeCoordinates(routeRow.coordinates);
      const coordinates = selectCoordinates(options, gpxCoordinates, jsonCoordinates);

      if (coordinates.length < 2) {
        stats.skippedRoutes += 1;
        console.warn(
          `[seed-output] skip route centre=${centreSlug} route=${routeName} reason=insufficient-coordinates`,
        );
        continue;
      }

      if (options.coordinatesSource === 'gpx' && gpxCoordinates.length < 2) {
        console.warn(
          `[seed-output] route centre=${centreSlug} route=${routeName} reason=gpx-missing-or-invalid fallback=json`,
        );
      }

      const distanceM = Math.max(
        1,
        Math.round(
          toNumber(routeRow.distanceM) ??
            toNumber(routeRow.distanceMeters) ??
            computeDistanceMeters(coordinates),
        ),
      );

      const durationEstS = Math.max(
        60,
        Math.round(
          toNumber(routeRow.durationS) ??
            toNumber(routeRow.estimatedDurationSeconds) ??
            computeDurationSeconds(distanceM),
        ),
      );

      const bbox = computeBbox(coordinates);
      const geojson = routeGeoJson(routeName, coordinates);
      const payload = buildRoutePayload(routeRow, metadata);
      importedExternalIds.add(externalRouteId);
      const routeNameLookupKey = routeNameKey(routeName);

      if (options.dryRun) {
        const existsDry =
          existingByExternalId.has(externalRouteId) ||
          (routeNameLookupKey ? existingByName.has(routeNameLookupKey) : false);
        if (existsDry) stats.updatedRoutes += 1;
        else stats.importedRoutes += 1;
        continue;
      }

      const existing =
        existingByExternalId.get(externalRouteId) ||
        (routeNameLookupKey ? existingByName.get(routeNameLookupKey) : undefined) ||
        null;

      const routeRecord = existing
        ? routeRepo.merge(existing, {
            centreId: centre.id,
            name: routeName,
            externalRouteId,
            distanceM,
            durationEstS,
            difficulty: mapDifficulty(routeRow.difficultyLevel),
            polyline: JSON.stringify(coordinates),
            bbox,
            geojson,
            gpx,
            coordinates,
            payload,
            isActive: true,
            version: Math.max(existing.version || 1, 1),
          })
        : routeRepo.create({
            centreId: centre.id,
            name: routeName,
            externalRouteId,
            distanceM,
            durationEstS,
            difficulty: mapDifficulty(routeRow.difficultyLevel),
            polyline: JSON.stringify(coordinates),
            bbox,
            geojson,
            gpx,
            coordinates,
            payload,
            isActive: true,
            version: 1,
          });

      await routeRepo.save(routeRecord);

      if (existing) {
        stats.updatedRoutes += 1;
        existingByExternalId.set(externalRouteId, routeRecord);
      } else {
        stats.importedRoutes += 1;
      }
      if (routeNameLookupKey) {
        existingByName.set(routeNameLookupKey, routeRecord);
      }
    }

    if (!options.dryRun && options.deactivateMissing) {
      for (const existingRoute of existingRoutes) {
        if (!existingRoute.externalRouteId) continue;
        if (importedExternalIds.has(existingRoute.externalRouteId)) continue;
        if (!existingRoute.isActive) continue;

        existingRoute.isActive = false;
        await routeRepo.save(existingRoute);
        stats.deactivatedRoutes += 1;
      }
    }

    if (options.syncProducts) {
      const result = await syncCentreProducts(productRepo, centre, options.dryRun);
      stats.productsCreated += result.created;
      stats.productsUpdated += result.updated;
    }

    console.log(
      `[seed-output] centre=${centreSlug} imported_routes=${stats.importedRoutes} updated_routes=${stats.updatedRoutes} skipped_routes=${stats.skippedRoutes}`,
    );
  }

  console.log('[seed-output] complete', {
    rootDir: options.rootDir,
    dryRun: options.dryRun,
    syncProducts: options.syncProducts,
    deactivateMissing: options.deactivateMissing,
    strictCentreCoords: options.strictCentreCoords,
    stats,
  });

  await dataSource.destroy();
}

run().catch(async (error: unknown) => {
  console.error('[seed-output] failed', error instanceof Error ? error.stack || error.message : error);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exit(1);
});
