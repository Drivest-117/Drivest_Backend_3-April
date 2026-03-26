import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateConsentsDto } from './dto/update-consents.dto';
import { AuditLog } from '../../entities/audit-log.entity';
import { v4 as uuid } from 'uuid';
import { AccessOverridesService } from '../access-overrides/access-overrides.service';
import { AppLegalService } from '../legal-acceptance/app-legal.service';
import type { Request } from 'express';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private readonly accessOverrides: AccessOverridesService,
    private readonly appLegalService: AppLegalService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.accessOverrides.applyToUser(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    await this.usersRepo.update(userId, dto);
    await this.auditRepo.save({ userId, action: 'USER_UPDATE', metadata: dto });
    return this.findById(userId);
  }

  async updateConsents(userId: string, dto: UpdateConsentsDto, req: Request) {
    await this.appLegalService.syncAuthenticatedConsentSnapshot(req, userId, dto);
    await this.auditRepo.save({
      userId,
      action: 'USER_CONSENT_UPDATE',
      metadata: {
        ...dto,
        serverTimestampApplied: true,
      },
    });
    return this.findById(userId);
  }

  async updatePushToken(userId: string, pushToken: string | null) {
    await this.usersRepo.update(userId, { pushToken });
    await this.auditRepo.save({
      userId,
      action: 'USER_PUSH_TOKEN_UPDATE',
      metadata: { hasToken: Boolean(pushToken) },
    });
    return this.findById(userId);
  }

  async softDelete(userId: string) {
    const user = await this.findById(userId);
    const anonymized = {
      email: null,
      phone: null,
      name: `deleted-${uuid()}`,
      pushToken: null,
      passwordResetCodeHash: null,
      passwordResetCodeExpiresAt: null,
      passwordResetFailedAttempts: 0,
      navigationAccessUntil: null,
    };
    await this.usersRepo.update(userId, anonymized);
    await this.usersRepo.softDelete(userId);
    await this.auditRepo.save({
      userId,
      action: 'USER_DELETE',
      metadata: {
        anonymizedEmail: user.email != null,
        clearedPushToken: Boolean(user.pushToken),
      },
    });
    return { success: true };
  }
}
