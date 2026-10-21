// Yêu cầu gửi mã OTP: mục đích (đổi mật khẩu / số điện thoại / email) và giá trị mới nếu có.

import { VerificationPurpose } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class RequestVerificationCodeDto {
  @IsEnum(VerificationPurpose)
  purpose: VerificationPurpose;

  /** The new phone or email, for a phone or email change. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  target?: string | null;
}
