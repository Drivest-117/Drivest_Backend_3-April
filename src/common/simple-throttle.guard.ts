import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SIMPLE_THROTTLE_KEY, SimpleThrottleRule } from './simple-throttle.decorator';

type CounterEntry = {
  count: number;
  expiresAt: number;
};

@Injectable()
export class SimpleThrottleGuard implements CanActivate {
  private static readonly counters = new Map<string, CounterEntry>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<SimpleThrottleRule | undefined>(
      SIMPLE_THROTTLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rule) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      originalUrl?: string;
      body?: Record<string, unknown>;
    }>();
    const now = Date.now();
    const identityParts = [
      request.ip ?? 'unknown-ip',
      request.originalUrl ?? 'unknown-route',
      typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '',
      typeof request.body?.transactionId === 'string' ? request.body.transactionId.trim() : '',
    ];
    const key = identityParts.join('|');

    const existing = SimpleThrottleGuard.counters.get(key);
    if (!existing || existing.expiresAt <= now) {
      SimpleThrottleGuard.counters.set(key, {
        count: 1,
        expiresAt: now + rule.ttlMs,
      });
      return true;
    }

    if (existing.count >= rule.limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    SimpleThrottleGuard.counters.set(key, existing);
    return true;
  }
}
