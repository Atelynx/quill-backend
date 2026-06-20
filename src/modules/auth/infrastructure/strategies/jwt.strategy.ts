import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../../../users/application/services/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!Number.isInteger(payload.tokenVersion)) {
      throw new UnauthorizedException('El token ya no es válido.');
    }

    const user = await this.usersService
      .findById(payload.sub)
      .catch((error: unknown) => {
        if (error instanceof NotFoundException) {
          throw new UnauthorizedException('El token ya no es válido.');
        }
        throw error;
      });

    const currentTokenVersion = user.tokenVersion ?? 0;
    if (currentTokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('El token ya no es válido.');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: currentTokenVersion,
    };
  }
}
