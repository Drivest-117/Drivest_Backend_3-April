import { SetMetadata } from '@nestjs/common';

export const SIMPLE_THROTTLE_KEY = 'simple_throttle_rule';

export type SimpleThrottleRule = {
  limit: number;
  ttlMs: number;
};

export const SimpleThrottle = (limit: number, ttlMs: number) =>
  SetMetadata(SIMPLE_THROTTLE_KEY, { limit, ttlMs } satisfies SimpleThrottleRule);
