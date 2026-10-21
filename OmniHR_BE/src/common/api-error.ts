import { HttpException, HttpStatus } from "@nestjs/common";

export class ApiError extends HttpException {
  constructor(
    statusCode: HttpStatus,
    message: string,
    public readonly errorCode: string
  ) {
    super({ success: false, message, errorCode }, statusCode);
  }
}
