import { SetMetadata } from '@nestjs/common';

export const SIMPLE_THROTTLE_KEY = 'simple_throttle_rule';

export type SimpleThrottleRule = {
  limit: number;
  ttlMs: number;
  resetOnSuccess?: boolean;
};

export const SimpleThrottle = (
  limit: number,
  ttlMs: number,
  options: Pick<SimpleThrottleRule, 'resetOnSuccess'> = {},
) =>
  SetMetadata(
    SIMPLE_THROTTLE_KEY,
    { limit, ttlMs, ...options } satisfies SimpleThrottleRule,
  );
