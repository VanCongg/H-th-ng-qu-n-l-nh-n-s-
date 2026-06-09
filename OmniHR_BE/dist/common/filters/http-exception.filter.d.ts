import { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
export declare class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private normalizeMessage;
    private errorCodeForStatus;
    private prismaMessage;
}
