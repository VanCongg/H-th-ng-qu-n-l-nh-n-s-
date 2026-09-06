import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "./auth.service";
import { JwtAccessPayload } from "./jwt-payload.type";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requiredConfig(config, "JWT_ACCESS_SECRET")
    });
  }

  async validate(payload: JwtAccessPayload) {
    const user = await this.authService.hydrateAuthUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException("Unauthorized");
    }

    return user;
  }
}

function requiredConfig(config: ConfigService, key: string) {
  const value = config.get<string>(key);
  if (!value) {
    throw new Error(`Missing required config: ${key}`);
  }
  return value;
}
