// Dữ liệu đăng nhập: username / email / mã nhân viên và mật khẩu.

import { IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @MaxLength(160)
  usernameOrEmail: string;

  @IsString()
  @MinLength(6)
  @MaxLength(120)
  password: string;
}
