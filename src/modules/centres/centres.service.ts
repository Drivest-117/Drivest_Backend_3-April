import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TestCentre } from '../../entities/test-centre.entity'
import { Route } from '../../entities/route.entity'
import { CentreQueryDto } from './dto/centre-query.dto'
import { GeocodingService } from '../../common/geocoding.service'

@Injectable()
export class CentresService {
  constructor(
    @InjectRepository(TestCentre)
    private centresRepo: Repository<TestCentre>,

    @InjectRepository(Route)
    private routesRepo: Repository<Route>,

    private geocodingService: GeocodingService,
  ) {}

  private looksLikeUkPostcode(q: string): boolean {
    const s = (q || '').trim().toUpperCase()
    // permissive UK postcode check: outward + inward
    // examples: CO1 1AG, SW1A 1AA, M1 1AE
    return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(s)
  }

  private looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    )
  }

  private normalizeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
  }

  private async resolveCentre(idOrSlug: string): Promise<TestCentre | null> {
    const key = (idOrSlug || '').trim()
    if (!key) return null

    if (this.looksLikeUuid(key)) {
      const byId = await this.centresRepo.findOne({ where: { id: key } })
      if (byId) return byId
    }

    const normalized = this.normalizeSlug(key)
    if (normalized) {
      const bySlug = await this.centresRepo
        .createQueryBuilder('centre')
        .where('LOWER(centre.slug) = :slug', { slug: normalized })
        .orWhere('LOWER(centre.name) LIKE :namePrefix', {
          namePrefix: `${normalized.replace(/-/g, ' ')}%`,
        })
        .orderBy('centre.createdAt', 'ASC')
        .getOne()
      if (bySlug) return bySlug
    }

    return null
  }

  async search(dto: CentreQueryDto) {
    const page = dto.page ? parseInt(dto.page, 10) : 1
    const limit = dto.limit ? Math.min(parseInt(dto.limit, 10), 50) : 20

    const runTextSearch = async () => {
      const qb = this.centresRepo.createQueryBuilder('centre')

      if (dto.query) {
        qb.andWhere(
          '(centre.name ILIKE :q OR centre.postcode ILIKE :q OR centre.city ILIKE :q)',
          { q: `%${dto.query}%` },
        )
      }

      if (dto.near) {
        const [latStr, lngStr] = dto.near.split(',')
        const lat = parseFloat(latStr)
        const lng = parseFloat(lngStr)
        const radiusKm = dto.radiusKm ? parseFloat(dto.radiusKm) : 50

        qb.andWhere(
          'ST_DWithin(centre.geo, ST_MakePoint(:lng, :lat)::geography, :radius)',
          {
            lat,
            lng,
            radius: radiusKm * 1000,
          },
        )
          .addSelect(
            'ST_Distance(centre.geo, ST_MakePoint(:lng, :lat)::geography)',
            'distance',
          )
          .orderBy('distance', 'ASC')
      }

      qb.skip((page - 1) * limit).take(limit)

      const [items, count] = await qb.getManyAndCount()
      return { items, count }
    }

    // 1) Normal behaviour first
    const first = await runTextSearch()
    if (first.count > 0 || !dto.query || dto.near) {
      return {
        items: first.items,
        meta: { page, limit, total: first.count },
      }
    }

    // 2) Fallback: postcode geocode -> nearby search
    const query = dto.query.trim()
    if (!this.looksLikeUkPostcode(query)) {
      return {
        items: [],
        meta: { page, limit, total: 0 },
      }
    }

    const hit = await this.geocodingService.geocodeAddress({
      address: query,
      country: 'United Kingdom',
    })

    if (!hit) {
      return {
        items: [],
        meta: { page, limit, total: 0 },
      }
    }

    const radiusKm = dto.radiusKm ? parseFloat(dto.radiusKm) : 25
    const qb2 = this.centresRepo.createQueryBuilder('centre')

    qb2.andWhere(
      'ST_DWithin(centre.geo, ST_MakePoint(:lng, :lat)::geography, :radius)',
      {
        lat: hit.lat,
        lng: hit.lng,
        radius: radiusKm * 1000,
      },
    )
      .addSelect(
        'ST_Distance(centre.geo, ST_MakePoint(:lng, :lat)::geography)',
        'distance',
      )
      .orderBy('distance', 'ASC')

    qb2.skip((page - 1) * limit).take(limit)

    const [items2, count2] = await qb2.getManyAndCount()

    return {
      items: items2,
      meta: { page, limit, total: count2 },
    }
  }

  async findOne(idOrSlug: string) {
    return this.resolveCentre(idOrSlug)
  }

  async routesForCentre(idOrSlug: string) {
    const centre = await this.resolveCentre(idOrSlug)
    if (!centre) return []

    const routes = await this.routesRepo.find({
      where: { centreId: centre.id, isActive: true },
    });
    
    // Remove gpx field from each route before returning
    return routes.map(route => {
      const { gpx, ...routeWithoutGpx } = route;
      return routeWithoutGpx;
    });
  }
}
