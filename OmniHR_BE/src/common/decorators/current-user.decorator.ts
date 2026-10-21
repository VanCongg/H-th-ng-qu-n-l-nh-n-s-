// @CurrentUser(): lấy người dùng đang đăng nhập (do JwtStrategy gắn vào request).

import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthUser } from "../types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  }
);
