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
      'drivest.practice.monthly.selected_centre.gbp12.99',
    androidProductId:
      process.env.APP_PLAN_PRACTICE_MONTHLY_PRODUCT_ID ||
      'drivest.practice.monthly.selected_centre.gbp12.99',
    type: ProductType.SUBSCRIPTION,
    pricePence: envInt('APP_PLAN_PRACTICE_MONTHLY_PENCE', 1299),
    period: ProductPeriod.MONTH,
    metadata: {
      label: 'Practice selected centre monthly',
      currencyCode: process.env.APP_PLAN_PRACTICE_MONTHLY_CURRENCY || 'GBP',
    },
  });

  await upsertProduct(repo, {
    iosProductId:
      process.env.APP_PLAN_NAVIGATION_YEARLY_PRODUCT_ID ||
      process.env.APP_PLAN_NAVIGATION_MONTHLY_PRODUCT_ID ||
      'drivest.navigation.only.gbp19_99.yearly',
    androidProductId:
      process.env.APP_PLAN_NAVIGATION_YEARLY_PRODUCT_ID ||
      process.env.APP_PLAN_NAVIGATION_MONTHLY_PRODUCT_ID ||
      'drivest.navigation.only.gbp19_99.yearly',
    type: ProductType.SUBSCRIPTION,
    pricePence: envInt('APP_PLAN_NAVIGATION_YEARLY_PENCE', envInt('APP_PLAN_NAVIGATION_MONTHLY_PENCE', 1999)),
    period: ProductPeriod.YEAR,
    metadata: {
      label: 'Navigation yearly',
      currencyCode:
        process.env.APP_PLAN_NAVIGATION_YEARLY_CURRENCY ||
        process.env.APP_PLAN_NAVIGATION_MONTHLY_CURRENCY ||
        'GBP',
    },
  });

  await upsertProduct(repo, {
    iosProductId:
      process.env.APP_PLAN_ANNUAL_BUNDLE_PRODUCT_ID ||
      process.env.APP_PLAN_NAVIGATION_BUNDLE_PRODUCT_ID ||
      'drivest.annual.bundle.gbp29_99.yearly',
    androidProductId:
      process.env.APP_PLAN_ANNUAL_BUNDLE_PRODUCT_ID ||
      process.env.APP_PLAN_NAVIGATION_BUNDLE_PRODUCT_ID ||
      'drivest.annual.bundle.gbp29_99.yearly',
    type: ProductType.SUBSCRIPTION,
    pricePence: envInt('APP_PLAN_ANNUAL_BUNDLE_PENCE', envInt('APP_PLAN_NAVIGATION_BUNDLE_PENCE', 2999)),
    period: ProductPeriod.YEAR,
    metadata: {
      label: 'Annual bundle',
      currencyCode:
        process.env.APP_PLAN_ANNUAL_BUNDLE_CURRENCY ||
        process.env.APP_PLAN_NAVIGATION_BUNDLE_CURRENCY ||
        'GBP',
      navigationDurationMonths: envInt(
        'APP_PLAN_ANNUAL_BUNDLE_NAV_MONTHS',
        envInt('APP_PLAN_NAVIGATION_BUNDLE_NAV_MONTHS', 12)
      ),
      centreDurationMonths: envInt(
        'APP_PLAN_ANNUAL_BUNDLE_CENTRE_MONTHS',
        envInt('APP_PLAN_NAVIGATION_BUNDLE_CENTRE_MONTHS', 1)
      ),
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
