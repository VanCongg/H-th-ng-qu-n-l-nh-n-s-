// Dữ liệu đặt lại mật khẩu: tên đăng nhập, mã email, mật khẩu mới.

import { IsString, Length, MaxLength, MinLength } from "class-validator";
import { IsStrongPassword } from "../../common/validators/strong-password";

export class ResetPasswordDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  identifier: string;

  /** The code emailed by POST /auth/forgot-password. */
  @IsString()
  @Length(6, 6)
  otpCode: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  @IsStrongPassword()
  newPassword: string;
}
