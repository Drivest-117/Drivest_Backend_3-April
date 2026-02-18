# Drivest OSM Hazard Backend Architecture

## Purpose
This backend subsystem enriches navigation with OSM-derived road hazards and exposes them through existing route/navigation APIs, with CRS-safe spatial queries, route-relative ordering, caching, stale detection, and recompute controls.

## Main Modules
1. `backend/src/modules/routes/road-hazard.service.ts`
- Core hazard engine.
- Builds route-corridor hazards (`road_hazards_v1` payload).
- Builds live nearby hazards (optionally route-relative).
- Handles SRID resolution, geometry transforms, dedup, mapping rules, confidence/priority, caching.

2. `backend/src/modules/routes/routes.service.ts`
- Orchestrates route hazard retrieval and persistence.
- Entitlement checks.
- Stale detection and lazy recompute.
- `refresh=1` handling with role guard behavior.

3. `backend/src/modules/routes/routes.controller.ts`
- `GET /routes/:id/hazards` (JWT protected).
- Passes query params and requester role to service.

4. `backend/src/modules/routes/navigation.controller.ts`
- `POST /navigation/hazards/nearby` (JWT protected).

5. `backend/src/modules/routes/dto/route-hazards-query.dto.ts`
- Query DTO for route hazards endpoint:
  - `refresh?: boolean`
  - `corridorWidthM?: number`
  - `limit?: number`
  - `types?: RoadHazardType[]`

6. `backend/src/modules/routes/dto/nearby-hazards.dto.ts`
- DTO for nearby endpoint:
  - `routeId?`, `aheadOnly?`, `aheadDistanceM?`, `backtrackToleranceM?`, etc.

7. Seed/Admin integration
- `backend/src/seed/seed.ts`
- `backend/src/seed/backfill-road-hazards.ts`
- `backend/src/modules/admin/admin.service.ts`
- All enrichment paths generate/store `road_hazards_v1` with `routeHash`.

## Data Sources
1. Postgres + PostGIS + osm2pgsql tables:
- `planet_osm_point`
- `planet_osm_line`
- `planet_osm_polygon` (optional)
- hstore tags expected.

2. Geometry column used by queries:
- Geometry column auto-detected at runtime per OSM table; cached; supports common osm2pgsql styles.

## Hazard Taxonomy and Mapping Rules
Types:
- `traffic_light`
- `zebra_crossing`
- `stop_sign`
- `give_way`
- `school_warning`
- `hazard_generic`

Rules are table-driven in `HAZARD_RULES`.

Confidence/Priority:
- Traffic lights / stop / give-way: `0.9`
- Zebra explicit: `0.85`
- School inferred: `0.6-0.75`
- Generic: `0.5`

Key strictness:
- `highway=crossing + zebra tags` => `zebra_crossing`
- `highway=crossing` without zebra tags => `hazard_generic`
- School warning from:
  - `hazard=school_zone|children`
  - `zone:traffic=school`
  - `maxspeed:type=school_zone`
  - `amenity=school` (corridor-aware)

## CRS/SRID Safety
Implemented in `RoadHazardService`:
- `resolveOsmSrid()` with cache (fallback `3857`)
- `toOsmGeom()` transforms WGS84 point into OSM SRID
- `routeLineToOsmSrid()` builds line in 4326 then transforms
- Distance and dwithin are meter-safe:
  - if SRID `4326`: geography casts
  - else projected geometry meters

All `ST_DWithin` / `ST_Distance` use same-SRID geometry paths.

## Query Architecture
1. Route corridor extraction (`GET /routes/:id/hazards`)
- Build route line CTE.
- UNION hazard queries across point/line/polygon.
- Spatial predicate first, tag filtering second.
- SQL dedup (`DISTINCT ON`) before final mapping.
- Sort: priority then distance.
- Cap limit (default/max aligned to 300).

2. Nearby extraction (`POST /navigation/hazards/nearby`)
- Build center point CTE.
- Optional route_line CTE if `routeId` provided.
- Compute route progress:
  - `p = ST_LineLocatePoint(routeLine, currentPoint)`
  - hazard progress and ahead distance (meters).
- Apply ahead/backtrack filters:
  - `aheadOnly`
  - `aheadDistanceM`
  - `backtrackToleranceM`
- Off-route fallback disables route-relative ordering when far from route.
- Sort:
  - `aheadDistM` asc (when route context),
  - then `priority` desc,
  - then `distM` asc.
- Cap results (`maxItems`, default 20).

## Dedup Strategy
1. Primary dedup:
- Key: `(source, osm_type, osm_id, type)`

2. Fallback spatial dedup:
- Same `type` within `8m`
- Keep best by:
  - higher priority
  - then higher confidence
  - then closer distance

## Payload Contracts
Stored in `routes.payload.road_hazards_v1`:

```json
{
  "version": "road_hazards_v1",
  "generatedAt": "ISO timestamp",
  "corridorWidthM": 45,
  "routeHash": "sha256...",
  "osmSnapshot": "timestamp string or null",
  "source_status": "ok|osm_unavailable|no_route_geometry",
  "items": [
    {
      "id": "...",
      "type": "traffic_light|zebra_crossing|stop_sign|give_way|school_warning|hazard_generic",
      "lat": 0,
      "lon": 0,
      "priority": 0,
      "source": "osm",
      "confidence": 0.0,
      "labels": { "primary": "..." }
    }
  ]
}
```

Nearby response item may include runtime-only:
- `distM`
- `aheadDistM`

## Stale/Recompute Logic
`GET /routes/:id/hazards` behavior:
- Returns stored payload if fresh.
- Recomputes and saves if stale:
  - missing payload
  - missing/invalid items
  - missing `routeHash`
  - `routeHash` mismatch vs current route geometry
  - missing `osmSnapshot` field (backward compatibility trigger)
- `refresh=1` forces recompute.
- Role behavior:
  - if role available: admin-only for forced refresh
  - if role unavailable: allowed with warning log

## Performance Strategy
1. Spatial-first SQL order to exploit GiST.
2. Limits:
- Corridor hazards capped.
- Nearby hazards capped (`maxItems`).
3. In-memory nearby cache:
- LRU+TTL cache with bounded entries and expiration.
- Uses grid-rounded location keys (instead of raw lat/lon) plus mode/radius/types/route fingerprint/ahead params.
4. Migration for spatial indexes:
- GiST indexes on OSM geometry columns with IF NOT EXISTS guards.

## Failure Behavior
Defensive fallback:
- Returns `source_status: osm_unavailable` if OSM infra/query unavailable.
- Returns `source_status: no_route_geometry` for invalid route geometry.
- No endpoint shape break; graceful empty `items`.

## End-to-End Data Flow
1. Seed/Admin route creation:
- Route geometry saved.
- Hazards computed and embedded in payload.

2. Client loads route hazards:
- `GET /routes/:id/hazards`
- Fresh payload returned or lazily recomputed.

3. Active navigation nearby:
- `POST /navigation/hazards/nearby`
- Returns filtered/sorted upcoming hazards with route-relative ordering when `routeId` is passed.
