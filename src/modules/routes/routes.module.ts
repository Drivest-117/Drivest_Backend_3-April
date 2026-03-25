import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RoutesService } from "./routes.service";
import { RoutesController } from "./routes.controller";
import { Route } from "../../entities/route.entity";
import { PracticeSession } from "../../entities/practice-session.entity";
import { RouteStat } from "../../entities/route-stat.entity";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { TestCentre } from "../../entities/test-centre.entity";
import { OsmSpeedService } from "./osm-speed.service";
import { NavigationController } from './navigation.controller';
import { HazardsController } from './hazards.controller';
import { CentreHazardsController } from './centre-hazards.controller';
import { OverpassAdvisoryCacheService } from './overpass-advisory-cache.service';

@Module({
  imports: [
    EntitlementsModule,
    TypeOrmModule.forFeature([Route, PracticeSession, RouteStat, TestCentre]),
  ],
  controllers: [
    RoutesController,
    NavigationController,
    HazardsController,
    CentreHazardsController,
  ],
  providers: [
    RoutesService,
    OsmSpeedService,
    OverpassAdvisoryCacheService,
  ],
})
export class RoutesModule {}
