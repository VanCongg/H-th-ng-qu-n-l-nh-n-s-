import { HttpException, HttpStatus } from "@nestjs/common";
export declare class ApiError extends HttpException {
    readonly errorCode: string;
    constructor(statusCode: HttpStatus, message: string, errorCode: string);
}
