import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entitlement, EntitlementScope } from '../../entities/entitlement.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class AccessOverridesService {
  private readonly adminEmails = new Set(['ferror@drivest.uk']);
  private readonly privilegedLearnerEmails = new Set([
    'ferror@drivest.uk',
    'afaanmati@gmail.com',
  ]);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Entitlement)
    private readonly entRepo: Repository<Entitlement>,
  ) {}

  async applyToUser<T extends Pick<User, 'id' | 'email' | 'role'>>(
    user: T,
  ): Promise<T> {
    if (!user?.id || !user.email) {
      return user;
    }

    const email = this.normalizeEmail(user.email);
    if (!email) {
      return user;
    }

    if (this.adminEmails.has(email) && user.role !== 'ADMIN') {
      await this.usersRepo.update({ id: user.id }, { role: 'ADMIN' });
      user.role = 'ADMIN';
    }

    if (this.hasPrivilegedLearnerAccess(email)) {
      await this.ensureGlobalEntitlement(user.id);
    }

    return user;
  }

  async applyToUserId(userId: string): Promise<User | null> {
    if (!userId) {
      return null;
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      return null;
    }

    return this.applyToUser(user);
  }

  hasOverridesForEmail(email: string | null | undefined): boolean {
    const normalized = this.normalizeEmail(email);
    if (!normalized) {
      return false;
    }
    return this.adminEmails.has(normalized) || this.privilegedLearnerEmails.has(normalized);
  }

  private hasPrivilegedLearnerAccess(email: string): boolean {
    return this.adminEmails.has(email) || this.privilegedLearnerEmails.has(email);
  }

  private normalizeEmail(email: string | null | undefined): string {
    return String(email ?? '')
      .trim()
      .toLowerCase();
  }

  private async ensureGlobalEntitlement(userId: string) {
    const existing = await this.entRepo
      .createQueryBuilder('ent')
      .where('ent.userId = :userId', { userId })
      .andWhere('ent.scope = :scope', { scope: EntitlementScope.GLOBAL })
      .andWhere('ent.isActive = true')
      .andWhere('(ent.endsAt IS NULL OR ent.endsAt > :now)', { now: new Date() })
      .getOne();

    if (existing) {
      return;
    }

    await this.entRepo.save(
      this.entRepo.create({
        userId,
        scope: EntitlementScope.GLOBAL,
        centreId: null,
        startsAt: new Date(),
        endsAt: null,
        isActive: true,
        sourcePurchaseId: null,
      }),
    );
  }
}
