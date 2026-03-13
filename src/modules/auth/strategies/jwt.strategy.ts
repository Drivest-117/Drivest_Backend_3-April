import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AccessOverridesService } from '../../access-overrides/access-overrides.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly accessOverrides: AccessOverridesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const fallbackUser = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role || 'USER',
    };
    if (!this.accessOverrides.hasOverridesForEmail(payload.email)) {
      return fallbackUser;
    }
    const user = await this.accessOverrides.applyToUserId(payload.sub);
    if (!user) {
      return fallbackUser;
    }
    return {
      userId: user.id,
      email: user.email ?? payload.email,
      role: user.role || fallbackUser.role,
    };
  }
}
