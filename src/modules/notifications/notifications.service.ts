import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as http2 from 'http2';
import { CashbackClaim } from '../../entities/cashback-claim.entity';
import { User } from '../../entities/user.entity';
import { UserNotification, UserNotificationCategory } from '../../entities/user-notification.entity';
import { CreateBroadcastNotificationDto } from './dto/create-broadcast-notification.dto';
import { ListMyNotificationsDto } from './dto/list-my-notifications.dto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private running = false;
  private apnsJwtCache: { token: string; expiresAtMs: number } | null = null;

  constructor(
    @InjectRepository(CashbackClaim) private cashbackRepo: Repository<CashbackClaim>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserNotification) private notificationsRepo: Repository<UserNotification>,
  ) {}

  onModuleInit() {
    setInterval(() => this.tick().catch(() => undefined), 60_000);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 25 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 40 * 60 * 1000);

      const claims = await this.cashbackRepo
        .createQueryBuilder('c')
        .leftJoin(User, 'u', 'u.id = c.userId')
        .where('c.testScheduledAt IS NOT NULL')
        .andWhere('c.reminderSentAt IS NULL')
        .andWhere('c.testScheduledAt BETWEEN :start AND :end', {
          start: windowStart.toISOString(),
          end: windowEnd.toISOString(),
        })
        .andWhere("(u.notificationsChoice IS NULL OR u.notificationsChoice = 'enable')")
        .andWhere('u.pushToken IS NOT NULL')
        .select(['c.id', 'c.userId', 'u.pushToken'])
        .getRawMany();

      for (const row of claims) {
        const token = row.u_pushToken as string | null;
        if (!token) continue;
        const ok = await this.sendPush(
          token,
          'Drivest reminder',
          'Your test is coming up. Start recording your drive to earn cashback.',
          { category: 'app_update' },
        );
        if (ok) {
          await this.cashbackRepo.update(row.c_id, { reminderSentAt: new Date() });
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async sendPush(
    to: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ): Promise<boolean> {
    if (this.isExpoPushToken(to)) {
      return this.sendExpoPush(to, title, body, payload);
    }
    if (this.isApnsDeviceToken(to)) {
      return this.sendApnsPush(to, title, body, payload);
    }
    this.logger.warn(`Push send skipped: unrecognized token format`);
    return false;
  }

  private async sendExpoPush(
    to: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          title,
          body,
          sound: 'default',
          priority: 'high',
          data: payload ?? undefined,
        }),
      });
      const json = await res.json();
      if (json?.data?.status === 'ok') return true;
      this.logger.warn(`Push send failed: ${JSON.stringify(json)}`);
      return false;
    } catch (e) {
      this.logger.warn(`Push error: ${String(e)}`);
      return false;
    }
  }

  private async sendApnsPush(
    deviceToken: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ): Promise<boolean> {
    const config = this.resolveApnsConfig();
    if (!config) {
      this.logger.warn('APNs send skipped: config missing');
      return false;
    }

    const jwt = this.buildApnsJwt(config);
    if (!jwt) {
      this.logger.warn('APNs send skipped: jwt unavailable');
      return false;
    }

    const host = config.useSandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
    const client = http2.connect(`https://${host}`);

    return await new Promise<boolean>((resolve) => {
      let responseBody = '';
      let settled = false;

      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        try {
          client.close();
        } catch {
          client.destroy();
        }
        resolve(value);
      };

      client.on('error', (error) => {
        this.logger.warn(`APNs session error: ${String(error)}`);
        finish(false);
      });

      const request = client.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': config.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      });

      request.setEncoding('utf8');
      request.on('response', (headers) => {
        const status = Number(headers[':status'] ?? 0);
        request.on('data', (chunk) => {
          responseBody += chunk;
        });
        request.on('end', () => {
          if (status >= 200 && status < 300) {
            finish(true);
            return;
          }
          this.logger.warn(`APNs send failed: status=${status} body=${responseBody}`);
          finish(false);
        });
      });

      request.on('error', (error) => {
        this.logger.warn(`APNs request error: ${String(error)}`);
        finish(false);
      });

      request.write(
        JSON.stringify({
          aps: {
            alert: { title, body },
            sound: 'default',
            badge: 1,
          },
          data: payload ?? {},
        }),
      );
      request.end();
    });
  }

  async createForUser(
    userId: string,
    category: UserNotificationCategory,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
    actorUserId?: string | null,
  ) {
    const notification = this.notificationsRepo.create({
      userId,
      actorUserId: actorUserId ?? null,
      category,
      title,
      body,
      payload: payload ?? null,
      readAt: null,
    });
    const saved = await this.notificationsRepo.save(notification);
    void this.dispatchPushForUser(userId, title, body, {
      category,
      ...(payload ?? {}),
    });
    return saved;
  }

  async createForUsers(
    userIds: string[],
    category: UserNotificationCategory,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
    actorUserId?: string | null,
  ) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!uniqueUserIds.length) return { created: 0 };

    const rows = uniqueUserIds.map((userId) =>
      this.notificationsRepo.create({
        userId,
        actorUserId: actorUserId ?? null,
        category,
        title,
        body,
        payload: payload ?? null,
        readAt: null,
      }),
    );
    await this.notificationsRepo.save(rows);
    void this.dispatchPushForUsers(
      uniqueUserIds,
      title,
      body,
      {
        category,
        ...(payload ?? {}),
      },
    );
    return { created: rows.length };
  }

  async listForUser(userId: string, query: ListMyNotificationsDto) {
    const limit = query.limit ?? 30;
    const qb = this.notificationsRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .andWhere('n.deleted_at IS NULL');

    if (query.after) {
      const afterDate = new Date(query.after);
      if (!Number.isNaN(afterDate.getTime())) {
        qb.andWhere('n.created_at > :after', { after: afterDate.toISOString() });
      }
    }

    if (query.unreadOnly) {
      qb.andWhere('n.read_at IS NULL');
    }

    const items = await qb.orderBy('n.created_at', 'DESC').limit(limit).getMany();
    const unreadCount = await this.notificationsRepo.count({
      where: { userId, readAt: IsNull(), deletedAt: IsNull() },
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        category: item.category,
        title: item.title,
        body: item.body,
        payload: item.payload,
        createdAt: item.createdAt,
        readAt: item.readAt,
      })),
      unreadCount,
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.notificationsRepo.findOne({
      where: { id: notificationId, userId, deletedAt: IsNull() },
    });
    if (!notification) return { success: false };
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationsRepo.save(notification);
    }
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.notificationsRepo
      .createQueryBuilder()
      .update(UserNotification)
      .set({ readAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('deleted_at IS NULL')
      .andWhere('read_at IS NULL')
      .execute();
    return { success: true };
  }

  async broadcast(actorUserId: string, dto: CreateBroadcastNotificationDto) {
    if (dto.targetUserId) {
      await this.createForUser(
        dto.targetUserId,
        dto.category ?? 'admin_message',
        dto.title,
        dto.body,
        dto.payload,
        actorUserId,
      );
      return { created: 1 };
    }

    const qb = this.userRepo.createQueryBuilder('u').where('u.deletedAt IS NULL');
    const targetRole = dto.targetRole ?? 'all';
    if (targetRole === 'learner') {
      qb.andWhere("u.role = 'USER'");
    } else if (targetRole === 'instructor') {
      qb.andWhere("u.role = 'INSTRUCTOR'");
    }
    const users = await qb.select('u.id', 'id').getRawMany<{ id: string }>();

    return this.createForUsers(
      users.map((u) => u.id),
      dto.category ?? 'admin_message',
      dto.title,
      dto.body,
      dto.payload,
      actorUserId,
    );
  }

  private async dispatchPushForUser(
    userId: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ) {
    const user = await this.userRepo.findOne({
      where: { id: userId, deletedAt: IsNull() },
      select: ['id', 'notificationsChoice', 'pushToken'],
    });
    if (!user || user.notificationsChoice === 'skip' || !user.pushToken) {
      return;
    }
    await this.sendPush(user.pushToken, title, body, payload);
  }

  private async dispatchPushForUsers(
    userIds: string[],
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!uniqueUserIds.length) return;

    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.id IN (:...userIds)', { userIds: uniqueUserIds })
      .andWhere('u.deletedAt IS NULL')
      .andWhere("(u.notificationsChoice IS NULL OR u.notificationsChoice = 'enable')")
      .andWhere('u.pushToken IS NOT NULL')
      .select(['u.id', 'u.pushToken'])
      .getRawMany<{ u_id: string; u_pushToken: string }>();

    await Promise.all(
      users.map((user) =>
        this.sendPush(user.u_pushToken, title, body, payload).catch((error) => {
          this.logger.warn(`Push dispatch failed for user=${user.u_id}: ${String(error)}`);
          return false;
        }),
      ),
    );
  }

  private isExpoPushToken(token: string): boolean {
    return /^ExponentPushToken\[[^\]]+\]$/.test(token.trim());
  }

  private isApnsDeviceToken(token: string): boolean {
    return /^[0-9a-fA-F]{64,200}$/.test(token.trim());
  }

  private resolveApnsConfig():
    | {
        keyId: string;
        teamId: string;
        bundleId: string;
        privateKey: string;
        useSandbox: boolean;
      }
    | null {
    const keyId = (process.env.APNS_KEY_ID ?? '').trim();
    const teamId = (process.env.APNS_TEAM_ID ?? '').trim();
    const bundleId = (process.env.APNS_BUNDLE_ID ?? process.env.IOS_BUNDLE_ID ?? '').trim();
    const rawPrivateKey = this.resolveApnsPrivateKey();
    if (!keyId || !teamId || !bundleId || !rawPrivateKey) {
      return null;
    }
    const env = (process.env.APNS_ENV ?? process.env.APNS_USE_SANDBOX ?? '').trim().toLowerCase();
    const useSandbox = env === 'sandbox' || env === 'true' || env === '1';
    return {
      keyId,
      teamId,
      bundleId,
      privateKey: rawPrivateKey,
      useSandbox,
    };
  }

  private resolveApnsPrivateKey(): string | null {
    const inline = (process.env.APNS_PRIVATE_KEY ?? '').trim();
    if (inline) {
      return inline.replace(/\\n/g, '\n');
    }

    const base64 = (process.env.APNS_PRIVATE_KEY_BASE64 ?? '').trim();
    if (!base64) {
      return null;
    }

    try {
      return Buffer.from(base64, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }

  private buildApnsJwt(config: {
    keyId: string;
    teamId: string;
    privateKey: string;
  }): string | null {
    const nowSec = Math.floor(Date.now() / 1000);
    if (this.apnsJwtCache && this.apnsJwtCache.expiresAtMs > Date.now()) {
      return this.apnsJwtCache.token;
    }

    try {
      const header = this.base64UrlEncode(
        JSON.stringify({ alg: 'ES256', kid: config.keyId }),
      );
      const claims = this.base64UrlEncode(
        JSON.stringify({ iss: config.teamId, iat: nowSec }),
      );
      const signingInput = `${header}.${claims}`;
      const signer = crypto.createSign('sha256');
      signer.update(signingInput);
      signer.end();
      const signature = signer.sign(config.privateKey);
      const token = `${signingInput}.${this.base64UrlEncode(signature)}`;
      this.apnsJwtCache = {
        token,
        expiresAtMs: Date.now() + 50 * 60 * 1000,
      };
      return token;
    } catch (error) {
      this.logger.warn(`APNs JWT build failed: ${String(error)}`);
      return null;
    }
  }

  private base64UrlEncode(value: string | Buffer): string {
    return Buffer.from(value)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
}
