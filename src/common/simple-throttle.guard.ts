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
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const response = context.switchToHttp().getResponse<{
      setHeader(name: string, value: number | string): void;
      once(event: string, listener: () => void): void;
      statusCode?: number;
    }>();
    const now = Date.now();
    const installIdHeader = request.headers?.['x-drivest-install-id'];
    const installId = Array.isArray(installIdHeader) ? installIdHeader[0] : installIdHeader;
    const identityParts = [
      installId?.trim().toLowerCase() ?? '',
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
      this.attachResetOnSuccess(response, key, rule);
      return true;
    }

    if (existing.count >= rule.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      response.setHeader('Retry-After', retryAfterSeconds);
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    SimpleThrottleGuard.counters.set(key, existing);
    this.attachResetOnSuccess(response, key, rule);
    return true;
  }

  private attachResetOnSuccess(
    response: { once(event: string, listener: () => void): void; statusCode?: number },
    key: string,
    rule: SimpleThrottleRule,
  ) {
    if (!rule.resetOnSuccess) {
      return;
    }

    response.once('finish', () => {
      if ((response.statusCode ?? 500) < 400) {
        SimpleThrottleGuard.counters.delete(key);
      }
    });
  }
}
