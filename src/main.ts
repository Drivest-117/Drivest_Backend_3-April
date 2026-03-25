import { NestFactory, ModulesContainer } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { TransformInterceptor } from './common/transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { CashbackModule } from './modules/cashback/cashback.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ContentPacksModule } from './modules/content-packs/content-packs.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { LegalAcceptanceModule } from './modules/legal-acceptance/legal-acceptance.module';
import { CentresModule } from './modules/centres/centres.module';
import { RoutesModule } from './modules/routes/routes.module';
import { AdminModule } from './modules/admin/admin.module';
import { InstructorsModule } from './modules/instructors/instructors.module';
import { ParkingModule } from './modules/parking/parking.module';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

type OpenApiOperation = {
  operationId: string;
  summary: string;
  tags: string[];
  responses: Record<string, { description: string }>;
  security?: Array<Record<string, string[]>>;
};

type MetadataGuardTarget = object & { name?: string };
type MetadataHandler = (...args: any[]) => unknown;

const REQUEST_METHOD_TO_OPENAPI: Partial<Record<RequestMethod, string>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.DELETE]: 'delete',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.OPTIONS]: 'options',
  [RequestMethod.HEAD]: 'head',
  [RequestMethod.ALL]: 'get',
};

function normalizePathFragment(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/');
}

function normalizeOpenApiPath(...parts: string[]): string {
  const joined = parts
    .map((part) => normalizePathFragment(part))
    .filter((part) => part.length > 0)
    .join('/');
  const normalized = `/${joined}`.replace(/:(\w+)/g, '{$1}');
  return normalized === '/' ? normalized : normalized.replace(/\/+$/g, '');
}

function toPathVariants(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => toPathVariants(item));
  }
  if (typeof value === 'string') return [value];
  if (value == null) return [''];
  return [String(value)];
}

function toTagFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return 'default';
  if (/^v\d+$/i.test(segments[0]) && segments[1]) return segments[1];
  return segments[0];
}

function humanizeMethodName(methodName: string): string {
  return methodName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function hasJwtGuard(controllerType: MetadataGuardTarget, handler: MetadataHandler): boolean {
  const classGuards = Reflect.getMetadata(GUARDS_METADATA, controllerType) ?? [];
  const methodGuards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
  return [...classGuards, ...methodGuards].some((guard) =>
    typeof guard?.name === 'string' && guard.name.includes('JwtAuthGuard'),
  );
}

function buildFallbackSwaggerDocument(app: Awaited<ReturnType<typeof NestFactory.create>>) {
  const modules = app.get(ModulesContainer);
  const paths: Record<string, Record<string, OpenApiOperation>> = {};

  for (const moduleRef of modules.values()) {
    for (const controllerRef of moduleRef.controllers.values()) {
      const instance = controllerRef.instance;
      const controllerType = controllerRef.metatype;
      if (!instance || !controllerType) continue;

      const prototype = Object.getPrototypeOf(instance);
      const controllerPaths = toPathVariants(
        Reflect.getMetadata(PATH_METADATA, controllerType),
      );

      for (const methodName of Object.getOwnPropertyNames(prototype)) {
        if (methodName === 'constructor') continue;
        const handler = prototype[methodName];
        if (typeof handler !== 'function') continue;

        const methodPathMetadata = Reflect.getMetadata(PATH_METADATA, handler);
        const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler);
        const openApiMethod = REQUEST_METHOD_TO_OPENAPI[requestMethod as RequestMethod];
        if (!openApiMethod) continue;

        const handlerPaths = toPathVariants(methodPathMetadata);
        for (const controllerPath of controllerPaths) {
          for (const handlerPath of handlerPaths) {
            const fullPath = normalizeOpenApiPath(controllerPath, handlerPath);
            const tag = toTagFromPath(fullPath);
            paths[fullPath] ??= {};
            if (paths[fullPath][openApiMethod]) continue;
            paths[fullPath][openApiMethod] = {
              operationId: `${controllerType.name}_${methodName}`,
              summary: humanizeMethodName(methodName),
              tags: [tag],
              responses: {
                [openApiMethod === 'post' ? '201' : '200']: {
                  description: 'Success',
                },
              },
              ...(hasJwtGuard(controllerType, handler)
                ? { security: [{ bearer: [] }] }
                : {}),
            };
          }
        }
      }
    }
  }

  return {
    openapi: '3.0.0',
    info: {
      title: 'Route Master API',
      version: '1.0.0',
      description:
        'Route-complete fallback Swagger document. Full schema generation is still bypassed when circular geo model metadata prevents Nest Swagger from building component schemas.',
    },
    paths,
    components: {
      securitySchemes: {
        bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true, rawBody: true });
  const swaggerInclude = [
    HealthModule,
    AuthModule,
    UsersModule,
    CentresModule,
    RoutesModule,
    EntitlementsModule,
    CashbackModule,
    WebhooksModule,
    AdminModule,
    NotificationsModule,
    InstructorsModule,
    ParkingModule,
    AnalyticsModule,
    ContentPacksModule,
    DisputesModule,
    LegalAcceptanceModule,
  ];
  const httpLogger = new Logger('HTTP');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      httpLogger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`,
      );
    });
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const configService = app.get(ConfigService);
  const bootstrapLogger = new Logger('Bootstrap');
  const swaggerEnabled = configService.get<string>('SWAGGER_ENABLED', 'true') !== 'false';
  if (swaggerEnabled) {
    const swaggerPath = configService.get<string>('SWAGGER_PATH', '/docs');
    try {
      const config = new DocumentBuilder()
        .setTitle('Route Master API')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config, {
        include: swaggerInclude,
      });
      SwaggerModule.setup(swaggerPath, app, document);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      bootstrapLogger.error(`Swagger initialisation skipped: ${message}`);
      const fallbackDocument = buildFallbackSwaggerDocument(app);
      SwaggerModule.setup(swaggerPath, app, fallbackDocument as any);
    }
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}
bootstrap();
