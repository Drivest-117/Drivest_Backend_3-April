import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { CentresModule } from '../modules/centres/centres.module';
import { RoutesModule } from '../modules/routes/routes.module';
import { EntitlementsModule } from '../modules/entitlements/entitlements.module';
import { CashbackModule } from '../modules/cashback/cashback.module';
import { WebhooksModule } from '../modules/webhooks/webhooks.module';
import { HealthModule } from '../modules/health/health.module';
import { AdminModule } from '../modules/admin/admin.module';
import { User } from '../entities/user.entity';
import { TestCentre } from '../entities/test-centre.entity';
import { Route, RouteDifficulty } from '../entities/route.entity';
import { Product, ProductPeriod, ProductType } from '../entities/product.entity';
import { Purchase } from '../entities/purchase.entity';
import { Entitlement, EntitlementScope } from '../entities/entitlement.entity';
import { PracticeSession } from '../entities/practice-session.entity';
import { RouteStat } from '../entities/route-stat.entity';
import { CashbackClaim } from '../entities/cashback-claim.entity';
import { Track } from '../entities/track.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { TransformInterceptor } from '../common/transform.interceptor';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { JwtService } from '@nestjs/jwt';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.REVENUECAT_WEBHOOK_SECRET = 'revsecret';
process.env.PASSWORD_RESET_EXPOSE_CODE = 'true';
process.env.APP_ENTITLEMENTS_ENFORCED = 'true';
process.env.ACCESS_OVERRIDE_ADMIN_EMAILS = 'ferror@drivest.uk';
process.env.ACCESS_OVERRIDE_PRIVILEGED_EMAILS = 'afaanmati@gmail.com';
jest.setTimeout(20000);

describe('Route Master API (e2e)', () => {
  const strongPassword = 'Password1';
  let app: INestApplication;
  let module: TestingModule;
  let userRepo: Repository<User>;
  let centreRepo: Repository<TestCentre>;
  let routeRepo: Repository<Route>;
  let productRepo: Repository<Product>;
  let purchaseRepo: Repository<Purchase>;
  let entitlementRepo: Repository<Entitlement>;
  let jwtService: JwtService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: [
            User,
            TestCentre,
            Route,
            Product,
            Purchase,
            Entitlement,
            PracticeSession,
            RouteStat,
            CashbackClaim,
            Track,
            AuditLog,
          ],
          synchronize: true,
        }),
        AuthModule,
        UsersModule,
        CentresModule,
        RoutesModule,
        EntitlementsModule,
        CashbackModule,
        WebhooksModule,
        HealthModule,
        AdminModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    centreRepo = module.get<Repository<TestCentre>>(getRepositoryToken(TestCentre));
    routeRepo = module.get<Repository<Route>>(getRepositoryToken(Route));
    productRepo = module.get<Repository<Product>>(getRepositoryToken(Product));
    purchaseRepo = module.get<Repository<Purchase>>(getRepositoryToken(Purchase));
    entitlementRepo = module.get<Repository<Entitlement>>(getRepositoryToken(Entitlement));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('registers and logs in', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: strongPassword, name: 'Test User' })
      .expect(201);
    expect(register.body.data.accessToken).toBeDefined();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: strongPassword })
      .expect(200);
    expect(login.body.data.accessToken).toBeDefined();
  });

  it('blocks download without entitlement', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'ent@example.com', password: strongPassword, name: 'Ent User' });
    const token = register.body.data.accessToken;

    const centre = await centreRepo.save({
      name: 'Centre',
      address: 'addr',
      postcode: 'pc',
      city: 'city',
      country: 'UK',
      lat: 0,
      lng: 0,
      geo: 'POINT(0 0)' as any,
    });
    const route = await routeRepo.save({
      centreId: centre.id,
      name: 'R1',
      distanceM: 1000,
      durationEstS: 600,
      difficulty: RouteDifficulty.EASY,
      polyline: 'abc',
      bbox: {},
      version: 1,
      isActive: true,
    });

    await request(app.getHttpServer())
      .get(`/routes/${route.id}/download`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('grants admin access to ferror@drivest.uk during auth', async () => {
    const register = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: 'ferror@drivest.uk', password: strongPassword, name: 'Ferris Admin' })
      .expect(201);

    expect(register.body.data.accessToken).toBeDefined();
    expect(register.body.data.role).toBe('ADMIN');

    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${register.body.data.accessToken}`)
      .expect(200);

    expect(me.body.data.role).toBe('ADMIN');
  });

  it('resolves admin access for ferror@drivest.uk from a stale token', async () => {
    const existing =
      (await userRepo.findOne({ where: { email: 'ferror@drivest.uk' } })) ??
      (await userRepo.save({
        email: 'ferror@drivest.uk',
        phone: null,
        name: 'Ferris Admin',
        passwordHash: 'hash',
        role: 'USER',
      }));
    const user = await userRepo.save({ ...existing, role: 'USER' });
    const staleToken = jwtService.sign({
      sub: user.id,
      email: user.email,
      role: 'USER',
    });

    await request(app.getHttpServer())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${staleToken}`)
      .expect(200);

    const refreshedUser = await userRepo.findOne({ where: { id: user.id } });
    expect(refreshedUser?.role).toBe('ADMIN');
  });

  it('grants privileged learner route access to afaanmati@gmail.com', async () => {
    const register = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: 'afaanmati@gmail.com', password: strongPassword, name: 'Afaan Mati' })
      .expect(201);
    const token = register.body.data.accessToken;

    const centre = await centreRepo.save({
      name: 'Privileged Centre',
      address: 'addr',
      postcode: 'pc',
      city: 'city',
      country: 'UK',
      lat: 0,
      lng: 0,
      geo: 'POINT(0 0)' as any,
    });
    const route = await routeRepo.save({
      centreId: centre.id,
      name: 'R2',
      distanceM: 1000,
      durationEstS: 600,
      difficulty: RouteDifficulty.EASY,
      polyline: 'abc',
      bbox: {},
      version: 1,
      isActive: true,
    });

    await request(app.getHttpServer())
      .get(`/routes/${route.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const user = await userRepo.findOne({ where: { email: 'afaanmati@gmail.com' } });
    expect(user).toBeDefined();

    const entitlements = await entitlementRepo.find({ where: { userId: user!.id } });
    expect(entitlements.some((ent) => ent.scope === EntitlementScope.GLOBAL && ent.isActive)).toBe(true);
  });

  it('enforces cashback once per lifetime', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'cash@example.com', password: strongPassword, name: 'Cash User' });
    const token = register.body.data.accessToken;

    await request(app.getHttpServer())
      .post('/cashback/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/cashback/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('treats revenuecat webhook idempotently', async () => {
    const user = await userRepo.save({
      email: 'rev@example.com',
      phone: null,
      name: 'Rev User',
      passwordHash: 'hash',
    });

    await productRepo.save({
      type: ProductType.SUBSCRIPTION,
      pricePence: 999,
      period: ProductPeriod.MONTH,
      iosProductId: 'prod_sub',
      androidProductId: 'prod_sub',
      active: true,
    });

    const body = {
      event_id: 'evt1',
      product_id: 'prod_sub',
      transaction_id: 'tx123',
      app_user_id: user.id,
      type: 'PURCHASED',
      purchased_at: new Date().toISOString(),
      expiration_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
    const signature = createHmac('sha256', process.env.REVENUECAT_WEBHOOK_SECRET!)
      .update(JSON.stringify(body))
      .digest('hex');

    await request(app.getHttpServer())
      .post('/webhooks/revenuecat')
      .set('x-revenuecat-signature', signature)
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post('/webhooks/revenuecat')
      .set('x-revenuecat-signature', signature)
      .send(body)
      .expect(201);

    const purchases = await purchaseRepo.find({ where: { transactionId: 'tx123' } });
    expect(purchases).toHaveLength(1);
  });

  it('resets password through the v1 auth flow', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: 'reset@example.com', password: strongPassword, name: 'Reset User' })
      .expect(201);

    const forgot = await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' })
      .expect(200);

    const code = forgot.body.data?.devCode;
    expect(code).toHaveLength(6);

    await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({
        email: 'reset@example.com',
        code,
        newPassword: 'NewPassword123',
      })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/v1/auth/sign-in')
      .send({ email: 'reset@example.com', password: 'NewPassword123' })
      .expect(200);
    expect(login.body.data.accessToken).toBeDefined();
  });

  it('never exposes reset dev codes outside local and test environments', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: 'reset-prod@example.com', password: strongPassword, name: 'Reset Prod User' })
      .expect(201);

    const previousNodeEnv = process.env.NODE_ENV;
    const previousAppEnv = process.env.APP_ENV;
    const previousEnvironment = process.env.ENVIRONMENT;
    const previousExposeCode = process.env.PASSWORD_RESET_EXPOSE_CODE;

    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    process.env.ENVIRONMENT = 'production';
    process.env.PASSWORD_RESET_EXPOSE_CODE = 'true';

    try {
      const forgot = await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email: 'reset-prod@example.com' })
        .expect(200);

      expect(forgot.body.data?.message).toBe(
        'If an account exists for this email, a reset code has been sent.',
      );
      expect(forgot.body.data?.devCode).toBeUndefined();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousAppEnv === undefined) {
        delete process.env.APP_ENV;
      } else {
        process.env.APP_ENV = previousAppEnv;
      }
      if (previousEnvironment === undefined) {
        delete process.env.ENVIRONMENT;
      } else {
        process.env.ENVIRONMENT = previousEnvironment;
      }
      if (previousExposeCode === undefined) {
        delete process.env.PASSWORD_RESET_EXPOSE_CODE;
      } else {
        process.env.PASSWORD_RESET_EXPOSE_CODE = previousExposeCode;
      }
    }
  });

  it('accepts both modern and legacy push token payloads', async () => {
    const register = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: 'push@example.com', password: strongPassword, name: 'Push User' })
      .expect(201);
    const token = register.body.data.accessToken;

    const modern = await request(app.getHttpServer())
      .patch('/v1/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ pushToken: 'ExponentPushToken[modern-token]' })
      .expect(200);
    expect(modern.body.data.pushToken).toBe('ExponentPushToken[modern-token]');

    const legacy = await request(app.getHttpServer())
      .patch('/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ expoPushToken: 'ExponentPushToken[legacy-token]' })
      .expect(200);
    expect(legacy.body.data.pushToken).toBe('ExponentPushToken[legacy-token]');
  });
});
