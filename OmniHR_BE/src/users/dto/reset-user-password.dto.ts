import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { IsStrongPassword } from "../../common/validators/strong-password";

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  @IsStrongPassword()
  password: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
