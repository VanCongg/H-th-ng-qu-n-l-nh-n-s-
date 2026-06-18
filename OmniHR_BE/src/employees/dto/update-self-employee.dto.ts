import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateSelfEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000000)
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
