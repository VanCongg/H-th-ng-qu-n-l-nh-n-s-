export type JwtAccessPayload = {
    sub: number;
    username: string;
    email: string;
    roles: string[];
    permissions: string[];
    employeeId?: number | null;
};
export type JwtRefreshPayload = {
    sub: number;
    version: number;
};
