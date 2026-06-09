import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { Observable, map } from "rxjs";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload &&
          typeof payload === "object" &&
          "success" in payload &&
          "message" in payload
        ) {
          return payload;
        }

        return {
          success: true,
          message: "Success",
          data: payload ?? null
        };
      })
    );
  }
}
