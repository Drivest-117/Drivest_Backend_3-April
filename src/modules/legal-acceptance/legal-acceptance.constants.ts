import { ApiUserRole } from '../instructors/instructors.types';

export const MARKETPLACE_LEGAL_SURFACES = ['find_instructor', 'instructor_hub'] as const;
export type MarketplaceLegalSurface = (typeof MARKETPLACE_LEGAL_SURFACES)[number];

export const MARKETPLACE_LEGAL_SURFACE_ROLE_REQUIREMENTS: Record<
  MarketplaceLegalSurface,
  ApiUserRole
> = {
  find_instructor: 'learner',
  instructor_hub: 'instructor',
};

const DEFAULT_MARKETPLACE_LEGAL_VERSIONS: Record<MarketplaceLegalSurface, string> = {
  find_instructor: '2026-03-23.find_instructor.v1',
  instructor_hub: '2026-03-23.instructor_hub.v1',
};

const MARKETPLACE_LEGAL_VERSION_ENV_KEYS: Record<MarketplaceLegalSurface, string> = {
  find_instructor: 'LEGAL_VERSION_FIND_INSTRUCTOR',
  instructor_hub: 'LEGAL_VERSION_INSTRUCTOR_HUB',
};

export function resolveMarketplaceLegalVersion(surface: MarketplaceLegalSurface): string {
  const envKey = MARKETPLACE_LEGAL_VERSION_ENV_KEYS[surface];
  const envValue = process.env[envKey]?.trim();
  if (envValue) {
    return envValue;
  }
  return DEFAULT_MARKETPLACE_LEGAL_VERSIONS[surface];
}
