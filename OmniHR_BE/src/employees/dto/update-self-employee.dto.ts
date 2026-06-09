import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateSelfEmployeeDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  personalEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
