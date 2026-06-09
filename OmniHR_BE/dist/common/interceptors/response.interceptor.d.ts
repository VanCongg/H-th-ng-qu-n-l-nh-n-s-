import { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
export declare class ResponseInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
