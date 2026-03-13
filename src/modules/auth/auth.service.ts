import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import { User } from '../../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuditLog } from '../../entities/audit-log.entity';
import { Entitlement, EntitlementScope } from '../../entities/entitlement.entity';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AccessOverridesService } from '../access-overrides/access-overrides.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxResetAttempts = 5;

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(Entitlement) private entitlementRepo: Repository<Entitlement>,
    private jwtService: JwtService,
    private accessOverrides: AccessOverridesService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role = dto.role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'USER';
    const user = this.usersRepo.create({
      email: dto.email,
      name: dto.name,
      phone: dto.phone ?? null,
      passwordHash,
      role,
    });
    await this.usersRepo.save(user);
    await this.accessOverrides.applyToUser(user);
    await this.ensureWhitelistedEntitlement(user);
    await this.auditRepo.save({
      userId: user.id,
      action: 'USER_REGISTER',
      metadata: { email: user.email },
    });
    return this.buildToken(user);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { email },
      select: ['id', 'email', 'name', 'passwordHash', 'role'],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    await this.accessOverrides.applyToUser(user);
    await this.ensureWhitelistedEntitlement(user);
    return this.buildToken(user);
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const genericMessage = 'If an account exists for this email, a reset code has been sent.';
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .select(['user.id', 'user.email'])
      .where('LOWER(user.email) = :email', { email })
      .getOne();

    if (!user) {
      return { message: genericMessage };
    }

    const code = this.generateResetCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + this.passwordResetCodeTtlMs());

    await this.usersRepo.update(
      { id: user.id },
      {
        passwordResetCodeHash: codeHash,
        passwordResetCodeExpiresAt: expiresAt,
        passwordResetFailedAttempts: 0,
      },
    );

    await this.auditRepo.save({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      metadata: { email: user.email },
    });

    if (this.shouldExposePasswordResetCode()) {
      this.logger.warn(`password_reset_dev_code email=${user.email ?? 'unknown'} code=${code}`);
      return { message: genericMessage, devCode: code };
    }
    return { message: genericMessage };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const code = dto.code.trim();
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.passwordResetCodeHash',
        'user.passwordResetCodeExpiresAt',
        'user.passwordResetFailedAttempts',
      ])
      .where('LOWER(user.email) = :email', { email })
      .getOne();

    if (!user || !user.passwordResetCodeHash || !user.passwordResetCodeExpiresAt) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    if (user.passwordResetCodeExpiresAt.getTime() < Date.now()) {
      await this.clearResetState(user.id);
      throw new BadRequestException('Invalid or expired reset code');
    }

    const validCode = await bcrypt.compare(code, user.passwordResetCodeHash);
    if (!validCode) {
      const attempts = (user.passwordResetFailedAttempts ?? 0) + 1;
      if (attempts >= this.maxResetAttempts) {
        await this.clearResetState(user.id);
      } else {
        await this.usersRepo.update(
          { id: user.id },
          {
            passwordResetFailedAttempts: attempts,
          },
        );
      }
      throw new BadRequestException('Invalid or expired reset code');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepo.update(
      { id: user.id },
      {
        passwordHash,
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
        passwordResetFailedAttempts: 0,
      },
    );

    await this.auditRepo.save({
      userId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      metadata: { email: user.email },
    });

    return { message: 'Password reset successful' };
  }

  private buildToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role || 'USER' };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, role: user.role || 'USER' };
  }

  private generateResetCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private passwordResetCodeTtlMs(): number {
    const raw = Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES ?? 15);
    const minutes = Number.isFinite(raw) && raw > 0 ? raw : 15;
    return minutes * 60 * 1000;
  }

  private shouldExposePasswordResetCode(): boolean {
    const raw = (process.env.PASSWORD_RESET_EXPOSE_CODE ?? '').trim().toLowerCase();
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return process.env.NODE_ENV !== 'production';
  }

  private async clearResetState(userId: string) {
    await this.usersRepo.update(
      { id: userId },
      {
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
        passwordResetFailedAttempts: 0,
      },
    );
  }

  private async ensureWhitelistedEntitlement(user: User) {
    const whitelistEnv = process.env.WHITELIST_EMAILS || '';
    const whitelist = whitelistEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!user.email || !whitelist.includes(user.email.toLowerCase())) return;

    const existing = await this.entitlementRepo.findOne({
      where: { userId: user.id, scope: EntitlementScope.GLOBAL, isActive: true },
    });
    if (existing) return;

    const ent = this.entitlementRepo.create({
      userId: user.id,
      scope: EntitlementScope.GLOBAL,
      centreId: null,
      startsAt: new Date(),
      endsAt: null,
      isActive: true,
      sourcePurchaseId: null,
    });
    await this.entitlementRepo.save(ent);
  }
}
