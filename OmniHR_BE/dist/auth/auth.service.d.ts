import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    private readonly audit;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, audit: AuditService);
    login(dto: LoginDto, context?: RequestContext): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        user: AuthUser;
    }>;
    refresh(dto: RefreshTokenDto, context?: RequestContext): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        user: AuthUser;
    }>;
    logout(user: AuthUser, context?: RequestContext): Promise<{
        message: string;
    }>;
    me(user: AuthUser): Promise<AuthUser>;
    changePassword(user: AuthUser, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    hydrateAuthUser(userId: number): Promise<AuthUser | null>;
    private issueTokens;
    private saltRounds;
}
