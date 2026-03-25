import 'reflect-metadata';
import dataSource from '../database/typeorm.config';
import { Product, ProductPeriod, ProductType } from '../entities/product.entity';

function envInt(key: string, fallback: number): number {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

async function upsertProduct(repo: ReturnType<typeof dataSource.getRepository<Product>>, input: {
  iosProductId: string;
  androidProductId: string;
  type: ProductType;
  pricePence: number;
  period: ProductPeriod;
  metadata: Record<string, unknown>;
}) {
  const existing = await repo.findOne({
    where: [{ iosProductId: input.iosProductId }, { androidProductId: input.androidProductId }],
  });
  if (existing) {
    existing.type = input.type;
    existing.pricePence = input.pricePence;
    existing.period = input.period;
    existing.active = true;
    existing.metadata = input.metadata;
    return repo.save(existing);
  }
  return repo.save(
    repo.create({
      ...input,
      active: true,
    }),
  );
}

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(Product);

  await upsertProduct(repo, {
    iosProductId:
      process.env.APP_PLAN_PRACTICE_MONTHLY_PRODUCT_ID ||
      'drivest.practice.monthly.selected_centre.gbp12',
    androidProductId:
      process.env.APP_PLAN_PRACTICE_MONTHLY_PRODUCT_ID ||
      'drivest.practice.monthly.selected_centre.gbp12',
    type: ProductType.SUBSCRIPTION,
    pricePence: envInt('APP_PLAN_PRACTICE_MONTHLY_PENCE', 1200),
    period: ProductPeriod.MONTH,
    metadata: {
      label: 'Practice selected centre monthly',
      currencyCode: process.env.APP_PLAN_PRACTICE_MONTHLY_CURRENCY || 'GBP',
    },
  });

  await upsertProduct(repo, {
    iosProductId:
      process.env.APP_PLAN_NAVIGATION_MONTHLY_PRODUCT_ID ||
      'drivest.navigation.monthly.only.gbp10',
    androidProductId:
      process.env.APP_PLAN_NAVIGATION_MONTHLY_PRODUCT_ID ||
      'drivest.navigation.monthly.only.gbp10',
    type: ProductType.SUBSCRIPTION,
    pricePence: envInt('APP_PLAN_NAVIGATION_MONTHLY_PENCE', 1000),
    period: ProductPeriod.MONTH,
    metadata: {
      label: 'Navigation monthly',
      currencyCode: process.env.APP_PLAN_NAVIGATION_MONTHLY_CURRENCY || 'GBP',
    },
  });

  await upsertProduct(repo, {
    iosProductId:
      process.env.APP_PLAN_NAVIGATION_BUNDLE_PRODUCT_ID ||
      'drivest.navigation.bundle.3m_plus_centre_1m.gbp30',
    androidProductId:
      process.env.APP_PLAN_NAVIGATION_BUNDLE_PRODUCT_ID ||
      'drivest.navigation.bundle.3m_plus_centre_1m.gbp30',
    type: ProductType.CENTRE_PACK,
    pricePence: envInt('APP_PLAN_NAVIGATION_BUNDLE_PENCE', 3000),
    period: ProductPeriod.QUARTER,
    metadata: {
      label: 'Navigation bundle',
      currencyCode: process.env.APP_PLAN_NAVIGATION_BUNDLE_CURRENCY || 'GBP',
      navigationDurationMonths: envInt('APP_PLAN_NAVIGATION_BUNDLE_NAV_MONTHS', 3),
      centreDurationMonths: envInt('APP_PLAN_NAVIGATION_BUNDLE_CENTRE_MONTHS', 1),
    },
  });

  console.log('[upsert-app-products] baseline products ready');
  await dataSource.destroy();
}

run().catch(async (error) => {
  console.error('[upsert-app-products] fatal', error);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exit(1);
});
