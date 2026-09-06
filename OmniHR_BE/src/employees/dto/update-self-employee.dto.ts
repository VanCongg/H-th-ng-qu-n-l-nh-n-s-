import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";
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
  phone?: string;
}
