import { IsString, MaxLength, MinLength } from "class-validator";
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
}
