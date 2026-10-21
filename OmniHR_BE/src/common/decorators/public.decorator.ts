// @Public(): route không cần đăng nhập (JwtAuthGuard bỏ qua).

import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
