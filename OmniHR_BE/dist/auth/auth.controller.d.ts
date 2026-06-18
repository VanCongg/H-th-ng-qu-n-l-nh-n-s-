import { AuthUser, RequestContext } from "../common/types";
import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto, context: RequestContext): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        user: AuthUser;
    }>;
    refresh(dto: RefreshTokenDto, context: RequestContext): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        user: AuthUser;
    }>;
    logout(user: AuthUser, context: RequestContext): Promise<{
        message: string;
    }>;
    me(user: AuthUser): Promise<AuthUser>;
    changePassword(user: AuthUser, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
}
