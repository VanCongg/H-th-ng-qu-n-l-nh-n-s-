import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RequestVerificationCodeDto } from "./dto/request-verification-code.dto";
import { VerificationService } from "../verification/verification.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verification: VerificationService
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  login(@Body() dto: LoginDto, @ReqContext() context: RequestContext) {
    return this.authService.login(dto, context);
  }

  /** Emails a reset code to the account's address; the answer never says whether it exists. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60000 } })
  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto, @ReqContext() context: RequestContext) {
    return this.authService.forgotPassword(dto, context);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 15 * 60000 } })
  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto, @ReqContext() context: RequestContext) {
    return this.authService.resetPassword(dto, context);
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

  /** Emails a one-time code for a password, phone or email change. */
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("verification-codes")
  requestVerificationCode(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestVerificationCodeDto,
    @ReqContext() context: RequestContext
  ) {
    return this.verification.requestCode(user, dto.purpose, dto.target, context);
  }

  @ApiBearerAuth()
  @Post("change-password")
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @ReqContext() context: RequestContext
  ) {
    return this.authService.changePassword(user, dto, context);
  }
}
