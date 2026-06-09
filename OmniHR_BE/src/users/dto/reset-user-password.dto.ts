import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
