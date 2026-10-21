// Lỗi nghiệp vụ chuẩn của API: mã HTTP + thông báo + mã lỗi (code) để client xử lý.

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
