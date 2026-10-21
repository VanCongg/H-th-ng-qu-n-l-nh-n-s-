import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RequestContext } from "../types";

export const ReqContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext => {
    const request = context.switchToHttp().getRequest();
    return {
      ip: request.ip,
      userAgent: request.headers?.["user-agent"]
    };
  }
);
