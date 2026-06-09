import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  login(@Body() dto: LoginDto, @ReqContext() context: RequestContext) {
    return this.authService.login(dto, context);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto, @ReqContext() context: RequestContext) {
    return this.authService.refresh(dto, context);
  }

  @ApiBearerAuth()
  @Post("logout")
  logout(@CurrentUser() user: AuthUser, @ReqContext() context: RequestContext) {
    return this.authService.logout(user, context);
  }

  @ApiBearerAuth()
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }

  @ApiBearerAuth()
  @Post("change-password")
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user, dto);
  }
}
