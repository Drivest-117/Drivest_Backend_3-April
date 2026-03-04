import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CashbackClaim } from '../../entities/cashback-claim.entity';
import { User } from '../../entities/user.entity';
import { UserNotification, UserNotificationCategory } from '../../entities/user-notification.entity';
import { CreateBroadcastNotificationDto } from './dto/create-broadcast-notification.dto';
import { ListMyNotificationsDto } from './dto/list-my-notifications.dto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private running = false;

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
        .andWhere("u.notificationsChoice = 'enable'")
        .andWhere('u.expoPushToken IS NOT NULL')
        .select(['c.id', 'c.userId', 'u.expoPushToken'])
        .getRawMany();

      for (const row of claims) {
        const token = row.u_expoPushToken as string | null;
        if (!token) continue;
        const ok = await this.sendPush(token);
        if (ok) {
          await this.cashbackRepo.update(row.c_id, { reminderSentAt: new Date() });
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async sendPush(to: string): Promise<boolean> {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          title: 'Drivest reminder',
          body: 'Your test is coming up. Start recording your drive to earn cashback.',
          sound: 'default',
          priority: 'high',
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
    return this.notificationsRepo.save(notification);
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
}
