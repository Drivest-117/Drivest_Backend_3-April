import {
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
import { RoadHazardService } from './road-hazard.service';
import { RouteHazardsQueryDto } from './dto/route-hazards-query.dto';

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
    const route = await this.routesRepo.findOne({ where: { id }, relations: ['centre'] });
    if (!route) throw new NotFoundException('Route not found');
    await this.ensureEntitlement(userId, route);
    return route;
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
    if (refreshRequested && !requesterRole) {
      console.warn('[routes] allowing hazards refresh because requester role is unavailable', {
        routeId,
        userId,
      });
    } else if (refreshRequested && requesterRole !== 'ADMIN') {
      console.warn('[routes] rejected hazards refresh for non-admin user', {
        routeId,
        userId,
        requesterRole: requesterRole ?? null,
      });
      throw new ForbiddenException('Only admin users can force hazards refresh');
    }

    const hasCustomQuery = Boolean(
      query &&
        (query.corridorWidthM != null ||
          query.limit != null ||
          (query.types?.length ?? 0) > 0),
    );

    if (hasCustomQuery) {
      return this.roadHazardService.buildRouteHazards(route.coordinates, {
        rawGeojson: route.geojson,
        corridorWidthM: query?.corridorWidthM,
        limit: query?.limit,
        types: query?.types,
      });
    }

    const existing = route.payload?.road_hazards_v1;
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

    if (!refreshRequested && !isStale) {
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

  async getNearbyHazards(userId: string, dto: NearbyHazardsDto) {
    let routeCoordinates: any = null;

    if (dto.routeId) {
      const route = await this.routesRepo.findOne({ where: { id: dto.routeId } });
      if (!route) throw new NotFoundException('Route not found');
      await this.ensureEntitlement(userId, route);
      routeCoordinates = route.coordinates ?? route.geojson ?? null;
    }

    return this.roadHazardService.getNearbyHazards({
      lat: dto.lat,
      lon: dto.lon,
      mode: dto.mode,
      radiusM: dto.radiusM,
      limit: dto.limit,
      routeId: dto.routeId ?? null,
      routeCoordinates,
      routeCorridorM: dto.routeCorridorM,
      types: dto.types,
      aheadOnly: dto.aheadOnly,
      aheadDistanceM: dto.aheadDistanceM,
      backtrackToleranceM: dto.backtrackToleranceM,
    });
  }

  async download(userId: string, id: string, res: any) {
    const route = await this.routesRepo.findOne({
      where: { id },
      relations: ['centre'],
    });

    if (!route) {
      return res.status(404).send('Route not found');
    }

    // await this.ensureEntitlement(userId, route);

    if (!route.gpx) {
      return res.status(404).send('GPX not available');
    }

    console.log('GPX length', route.gpx.length);
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="route-${route.id}.gpx"`,
    );

    return res.send(route.gpx);
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
}
