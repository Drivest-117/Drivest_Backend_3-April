import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Route } from '../../entities/route.entity';
import { PracticeSession } from '../../entities/practice-session.entity';
import { RouteStat } from '../../entities/route-stat.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PracticeFinishDto } from './dto/practice-finish.dto';
import { TestCentre } from '../../entities/test-centre.entity';
import { NearbyHazardsDto } from './dto/nearby-hazards.dto';
import {
  RoadHazardItem,
  ROAD_HAZARD_TYPES,
  RoadHazardService,
  RoadHazardType,
  RouteHazardsV1,
} from './road-hazard.service';
import { RouteHazardsQueryDto } from './dto/route-hazards-query.dto';

type AppHazardFeature = {
  id: string;
  type: string;
  lat: number;
  lon: number;
  confidenceHint: number;
};

type BboxHazardsQuery = {
  south: number;
  west: number;
  north: number;
  east: number;
  centreId: string;
  types?: string[];
};

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private readonly routesRepo: Repository<Route>,

    @InjectRepository(PracticeSession)
    private readonly sessionRepo: Repository<PracticeSession>,

    @InjectRepository(RouteStat)
    private readonly statsRepo: Repository<RouteStat>,

    @InjectRepository(TestCentre)
    private readonly centreRepo: Repository<TestCentre>,

    private readonly entService: EntitlementsService,
    private readonly roadHazardService: RoadHazardService,
  ) {}

  async ensureEntitlement(userId: string, route: Route) {
    const allowed = await this.entService.hasAccess(userId, route.centreId);
    if (!allowed) throw new ForbiddenException('Entitlement required');
  }

  async getRoute(userId: string, id: string) {
    const route = await this.routesRepo.findOne({
      where: { id },
      relations: ['centre'],
    });
    if (!route) throw new NotFoundException('Route not found');
    await this.ensureEntitlement(userId, route);
    return route;
  }

  async getRouteByAppUserId(appUserId: string, id: string, deviceId?: string) {
    const user = await this.entService.resolveOrCreateAppUser(appUserId, deviceId);
    return this.getRoute(user.id, id);
  }

  async getRouteHazards(
    userId: string,
    routeId: string,
    query?: RouteHazardsQueryDto,
    requesterRole?: string | null,
  ) {
    const route = await this.routesRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('Route not found');
    await this.ensureEntitlement(userId, route);

    const refreshRequested = query?.refresh === true;
    if (refreshRequested && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Only admin users can force hazards refresh');
    }

    return this.resolveRouteHazards(route, {
      refresh: refreshRequested,
      corridorWidthM: query?.corridorWidthM,
      limit: query?.limit,
      types: query?.types,
    });
  }

  async getRouteHazardsByAppUserId(
    appUserId: string,
    routeId: string,
    query?: RouteHazardsQueryDto,
    deviceId?: string,
  ) {
    const user = await this.entService.resolveOrCreateAppUser(appUserId, deviceId);
    return this.getRouteHazards(user.id, routeId, query, null);
  }

  async getNearbyHazards(userId: string, dto: NearbyHazardsDto) {
    const lat = dto.lat ?? dto.center?.lat;
    const lon = dto.lon ?? dto.lng ?? dto.center?.lng;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new BadRequestException('lat/lon or center.lat/center.lng is required');
    }

    if (!dto.routeId && dto.centreId) {
      const centre = await this.resolveCentre(dto.centreId);
      if (!centre) throw new NotFoundException('Test centre not found');
      const allowed = await this.entService.hasAccess(userId, centre.id);
      if (!allowed) throw new ForbiddenException('Entitlement required');
    }

    let routeCoordinates: any = null;

    if (dto.routeId) {
      const route = await this.routesRepo.findOne({ where: { id: dto.routeId } });
      if (!route) throw new NotFoundException('Route not found');
      await this.ensureEntitlement(userId, route);
      routeCoordinates = route.coordinates ?? route.geojson ?? null;
    }

    const mappedTypes = this.normalizeNearbyTypes(dto.types);

    return this.roadHazardService.getNearbyHazards({
      lat,
      lon,
      mode: dto.mode,
      radiusM: dto.radiusM,
      limit: dto.limit,
      routeId: dto.routeId ?? null,
      routeCoordinates,
      routeCorridorM: dto.routeCorridorM,
      types: mappedTypes.length ? mappedTypes : undefined,
      aheadOnly: dto.aheadOnly,
      aheadDistanceM: dto.aheadDistanceM,
      backtrackToleranceM: dto.backtrackToleranceM,
    });
  }

  async getNearbyHazardsByAppUserId(
    appUserId: string,
    dto: NearbyHazardsDto,
    deviceId?: string,
  ) {
    const user = await this.entService.resolveOrCreateAppUser(appUserId, deviceId);
    return this.getNearbyHazards(user.id, dto);
  }

  async getCentreHazardsByAppUserId(
    appUserId: string,
    centreIdOrSlug: string,
    deviceId?: string,
  ) {
    const centre = await this.resolveCentre(centreIdOrSlug);
    if (!centre) throw new NotFoundException('Test centre not found');

    const allowed = await this.entService.hasAccessByAppUserId(
      appUserId,
      centre.id,
      deviceId,
    );
    if (!allowed) throw new ForbiddenException('Entitlement required');

    const routes = await this.routesRepo.find({
      where: { centreId: centre.id, isActive: true },
    });
    if (!routes.length) {
      return { hazards: [] as AppHazardFeature[] };
    }

    const payloads = await Promise.all(
      routes.map((route) => this.resolveRouteHazards(route, { refresh: false })),
    );
    const items = payloads.flatMap((payload) => payload.items ?? []);

    return { hazards: this.toAppHazards(items) };
  }

  async getRouteHazardsForBoundsByAppUserId(
    appUserId: string,
    query: BboxHazardsQuery,
    deviceId?: string,
  ) {
    const centre = await this.resolveCentre(query.centreId);
    if (!centre) throw new NotFoundException('Test centre not found');

    const allowed = await this.entService.hasAccessByAppUserId(
      appUserId,
      centre.id,
      deviceId,
    );
    if (!allowed) throw new ForbiddenException('Entitlement required');

    const mappedTypes = this.toRoadHazardTypesFromPromptTypes(query.types);
    if ((query.types?.length ?? 0) > 0 && mappedTypes.length === 0) {
      return { hazards: [] as AppHazardFeature[] };
    }

    const centerLat = (query.south + query.north) / 2;
    const centerLon = (query.west + query.east) / 2;
    const radiusM = this.computeBboxRadiusMeters(query);

    const nearby = await this.roadHazardService.getNearbyHazards({
      lat: centerLat,
      lon: centerLon,
      mode: 'PREVIEW',
      radiusM,
      limit: 800,
      routeId: null,
      routeCoordinates: null,
      routeCorridorM: 120,
      types: mappedTypes.length > 0 ? mappedTypes : undefined,
      aheadOnly: false,
      aheadDistanceM: 600,
      backtrackToleranceM: 120,
    });

    const withinBbox = nearby.items.filter(
      (item) =>
        item.lat >= query.south &&
        item.lat <= query.north &&
        item.lon >= query.west &&
        item.lon <= query.east,
    );

    return { hazards: this.toAppHazards(withinBbox) };
  }

  async download(userId: string, id: string, res: any) {
    const route = await this.routesRepo.findOne({
      where: { id },
      relations: ['centre'],
    });

    if (!route) {
      return res.status(404).send('Route not found');
    }

    await this.ensureEntitlement(userId, route);

    if (!route.gpx) {
      return res.status(404).send('GPX not available');
    }

    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="route-${route.id}.gpx"`,
    );

    return res.send(route.gpx);
  }

  async downloadByAppUserId(
    appUserId: string,
    id: string,
    res: any,
    deviceId?: string,
  ) {
    const user = await this.entService.resolveOrCreateAppUser(appUserId, deviceId);
    return this.download(user.id, id, res);
  }

  async startPractice(userId: string, routeId: string) {
    const route = await this.routesRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('Route not found');
    await this.ensureEntitlement(userId, route);

    const session = this.sessionRepo.create({
      userId,
      routeId,
      startedAt: new Date(),
      completed: false,
      endedAt: null,
    });

    return this.sessionRepo.save(session);
  }

  async startPracticeByAppUserId(
    appUserId: string,
    routeId: string,
    deviceId?: string,
  ) {
    const user = await this.entService.resolveOrCreateAppUser(appUserId, deviceId);
    return this.startPractice(user.id, routeId);
  }

  async finishPractice(userId: string, routeId: string, dto: PracticeFinishDto) {
    const route = await this.routesRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('Route not found');
    await this.ensureEntitlement(userId, route);

    const session = await this.sessionRepo.findOne({
      where: { userId, routeId, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
    if (!session) throw new NotFoundException('Active practice session not found');

    session.endedAt = new Date();
    session.completed = dto.completed;
    session.distanceM = dto.distanceM ?? null;
    session.durationS = dto.durationS ?? null;
    await this.sessionRepo.save(session);

    if (dto.completed) {
      let stat = await this.statsRepo.findOne({ where: { userId, routeId } });
      if (!stat) {
        stat = this.statsRepo.create({ userId, routeId, timesCompleted: 0 });
      }
      stat.timesCompleted += 1;
      stat.lastCompletedAt = new Date();
      if (dto.durationS && (!stat.bestTimeS || dto.durationS < stat.bestTimeS)) {
        stat.bestTimeS = dto.durationS;
      }
      await this.statsRepo.save(stat);
    }

    return session;
  }

  async finishPracticeByAppUserId(
    appUserId: string,
    routeId: string,
    dto: PracticeFinishDto,
    deviceId?: string,
  ) {
    const user = await this.entService.resolveOrCreateAppUser(appUserId, deviceId);
    return this.finishPractice(user.id, routeId, dto);
  }

  private async resolveRouteHazards(
    route: Route,
    options: {
      refresh: boolean;
      corridorWidthM?: number;
      limit?: number;
      types?: string[];
    },
  ): Promise<RouteHazardsV1> {
    const hasCustomQuery = Boolean(
      options.corridorWidthM != null ||
        options.limit != null ||
        (options.types?.length ?? 0) > 0,
    );
    if (hasCustomQuery) {
      return this.roadHazardService.buildRouteHazards(route.coordinates, {
        rawGeojson: route.geojson,
        corridorWidthM: options.corridorWidthM,
        limit: options.limit,
        types: options.types,
      });
    }

    const existing = route.payload?.road_hazards_v1 as RouteHazardsV1 | undefined;
    const currentRouteHash = this.roadHazardService.computeRouteHash(
      route.coordinates,
      route.geojson,
    );
    const existingRouteHash =
      typeof existing?.routeHash === 'string' ? existing.routeHash : null;
    const hasOsmSnapshotField =
      existing != null &&
      Object.prototype.hasOwnProperty.call(existing, 'osmSnapshot');
    const isStale =
      !existing ||
      !Array.isArray(existing.items) ||
      !existingRouteHash ||
      existingRouteHash !== currentRouteHash ||
      !hasOsmSnapshotField;

    if (!options.refresh && !isStale) {
      return existing;
    }

    const computed = await this.roadHazardService.buildRouteHazards(
      route.coordinates,
      { rawGeojson: route.geojson },
    );

    route.payload = {
      ...(route.payload ?? {}),
      road_hazards_v1: computed,
    };
    await this.routesRepo.save(route);

    return computed;
  }

  private toAppHazards(items: RoadHazardItem[]): AppHazardFeature[] {
    const deduped = new Map<string, AppHazardFeature>();
    for (const item of items) {
      const key = `${item.type}:${Number(item.lat).toFixed(6)}:${Number(item.lon).toFixed(6)}`;
      const mapped: AppHazardFeature = {
        id: String(item.id),
        type: this.toPromptType(item.type),
        lat: Number(item.lat),
        lon: Number(item.lon),
        confidenceHint: Number(item.confidence ?? 0.5),
      };
      deduped.set(key, mapped);
    }
    return Array.from(deduped.values());
  }

  private toPromptType(type: RoadHazardType): string {
    switch (type) {
      case 'traffic_light':
        return 'TRAFFIC_SIGNAL';
      case 'zebra_crossing':
        return 'ZEBRA_CROSSING';
      case 'give_way':
        return 'GIVE_WAY';
      case 'school_warning':
        return 'SCHOOL_ZONE';
      case 'stop_sign':
        return 'NO_ENTRY';
      default:
        return 'UNKNOWN';
    }
  }

  private toRoadHazardTypesFromPromptTypes(
    promptTypes?: string[],
  ): RoadHazardType[] {
    if (!promptTypes?.length) return [];

    const mapped = new Set<RoadHazardType>();
    for (const rawType of promptTypes) {
      const normalized = String(rawType ?? '')
        .trim()
        .replace(/-/g, '_')
        .toUpperCase();
      switch (normalized) {
        case 'TRAFFIC_SIGNAL':
          mapped.add('traffic_light');
          break;
        case 'ZEBRA_CROSSING':
          mapped.add('zebra_crossing');
          break;
        case 'GIVE_WAY':
          mapped.add('give_way');
          break;
        case 'SCHOOL_ZONE':
          mapped.add('school_warning');
          break;
        case 'NO_ENTRY':
          mapped.add('stop_sign');
          break;
        default:
          break;
      }
    }
    return Array.from(mapped);
  }

  private normalizeNearbyTypes(rawTypes?: string[]): RoadHazardType[] {
    if (!rawTypes?.length) return [];

    const direct = new Set<RoadHazardType>();
    const promptInput: string[] = [];

    for (const raw of rawTypes) {
      const normalized = String(raw ?? '')
        .trim()
        .replace(/-/g, '_')
        .toLowerCase();
      if (!normalized) continue;

      if ((ROAD_HAZARD_TYPES as readonly string[]).includes(normalized)) {
        direct.add(normalized as RoadHazardType);
        continue;
      }

      promptInput.push(raw);
    }

    const mapped = this.toRoadHazardTypesFromPromptTypes(promptInput);
    for (const type of mapped) {
      direct.add(type);
    }

    return Array.from(direct);
  }

  private computeBboxRadiusMeters(query: BboxHazardsQuery): number {
    const centerLat = (query.south + query.north) / 2;
    const centerLon = (query.west + query.east) / 2;
    const cornerLat = query.north;
    const cornerLon = query.east;
    const diagonalHalf = this.haversineMeters(
      centerLat,
      centerLon,
      cornerLat,
      cornerLon,
    );
    const radius = Math.round(diagonalHalf + 50);
    return Math.max(200, Math.min(5000, radius));
  }

  private haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const earthRadiusM = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusM * c;
  }

  private looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    );
  }

  private normalizeCentreSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  private async resolveCentre(idOrSlug: string): Promise<TestCentre | null> {
    const key = String(idOrSlug ?? '').trim();
    if (!key) throw new BadRequestException('centreId is required');

    if (this.looksLikeUuid(key)) {
      const byId = await this.centreRepo.findOne({ where: { id: key } });
      if (byId) return byId;
    }

    const normalized = this.normalizeCentreSlug(key);
    return this.centreRepo
      .createQueryBuilder('centre')
      .where('LOWER(centre.slug) = :slug', { slug: normalized })
      .orWhere('LOWER(centre.name) LIKE :namePrefix', {
        namePrefix: `${normalized.replace(/-/g, ' ')}%`,
      })
      .orderBy('centre.createdAt', 'ASC')
      .getOne();
  }
}
