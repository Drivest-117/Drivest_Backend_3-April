import 'reflect-metadata';
import dataSource from '../database/typeorm.config';
import { Route } from '../entities/route.entity';
import { RoadHazardService } from '../modules/routes/road-hazard.service';

const toBool = (raw: string | undefined, fallback: boolean) => {
  if (raw == null) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const clampInt = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
};

async function run() {
  await dataSource.initialize();

  const repo = dataSource.getRepository(Route);
  const roadHazardService = new RoadHazardService(dataSource);

  const batchSize = clampInt(Number(process.env.BACKFILL_HAZARDS_BATCH_SIZE ?? 50), 1, 500);
  const corridorWidthM = clampInt(Number(process.env.BACKFILL_HAZARDS_CORRIDOR_M ?? 45), 20, 200);
  const limit = clampInt(Number(process.env.BACKFILL_HAZARDS_LIMIT ?? 300), 1, 1000);
  const onlyMissing = toBool(process.env.BACKFILL_HAZARDS_ONLY_MISSING, true);
  const dryRun = toBool(process.env.BACKFILL_HAZARDS_DRY_RUN, false);
  const routeIdFilter = process.env.BACKFILL_HAZARDS_ROUTE_ID?.trim() || null;

  console.log('[backfill-road-hazards] start', {
    batchSize,
    corridorWidthM,
    limit,
    onlyMissing,
    dryRun,
    routeIdFilter,
  });

  let totalSeen = 0;
  let updated = 0;
  let skipped = 0;

  const qb = repo.createQueryBuilder('route').orderBy('route.createdAt', 'ASC');
  if (routeIdFilter) {
    qb.where('route.id = :routeId', { routeId: routeIdFilter });
  }

  const routes = await qb.getMany();

  for (let i = 0; i < routes.length; i += batchSize) {
    const batch = routes.slice(i, i + batchSize);

    for (const route of batch) {
      totalSeen += 1;

      const hasExisting = Boolean(
        route.payload?.road_hazards_v1 &&
          Array.isArray(route.payload?.road_hazards_v1?.items) &&
          typeof route.payload?.road_hazards_v1?.routeHash === 'string' &&
          Object.prototype.hasOwnProperty.call(route.payload?.road_hazards_v1, 'osmSnapshot'),
      );

      if (onlyMissing && hasExisting) {
        skipped += 1;
        continue;
      }

      try {
        const hazards = await roadHazardService.buildRouteHazards(route.coordinates, {
          rawGeojson: route.geojson,
          corridorWidthM,
          limit,
        });

        if (!dryRun) {
          route.payload = {
            ...(route.payload ?? {}),
            road_hazards_v1: hazards,
          };
          await repo.save(route);
        }

        updated += 1;
      } catch (error) {
        console.warn('[backfill-road-hazards] route failed', {
          routeId: route.id,
          message: (error as Error)?.message,
        });
      }
    }

    console.log('[backfill-road-hazards] batch complete', {
      processed: Math.min(i + batch.length, routes.length),
      total: routes.length,
      updated,
      skipped,
    });
  }

  console.log('[backfill-road-hazards] done', {
    totalSeen,
    updated,
    skipped,
    dryRun,
  });

  await dataSource.destroy();
}

run().catch(async (error) => {
  console.error('[backfill-road-hazards] fatal', error);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exit(1);
});
