// Dữ liệu đổi mật khẩu: mật khẩu hiện tại, mật khẩu mới (phải mạnh), mã OTP.

import { IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";
import { IsStrongPassword } from "../../common/validators/strong-password";

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(120)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  @IsStrongPassword()
  newPassword: string;

  /** The code emailed for PASSWORD_CHANGE (POST /auth/verification-codes). */
  @IsOptional()
  @IsString()
  @Length(6, 6)
  otpCode?: string;
}
