// Dữ liệu nhân viên tự sửa hồ sơ: ảnh đại diện, email, điện thoại, và mã OTP khi đổi email / điện thoại.

import { IsEmail, IsOptional, IsString, Length, MaxLength } from "class-validator";
import {
  IsSafeAvatar,
  MAX_AVATAR_VALUE_LENGTH
} from "../../common/validators/avatar";

export class UpdateSelfEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AVATAR_VALUE_LENGTH)
  @IsSafeAvatar()
  avatarUrl?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  personalEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  /** The code emailed for the phone or email change being made. */
  @IsOptional()
  @IsString()
  @Length(6, 6)
  otpCode?: string;
}
