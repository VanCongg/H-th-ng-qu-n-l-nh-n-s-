import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
  MaxLength,
  MinLength
} from "class-validator";
import { Type } from "class-transformer";
import { IsStrongPassword } from "../../common/validators/strong-password";
import { CreateUserEmployeeProfileDto } from "./user-employee-profile.dto";

export class CreateUserDto {
  @IsString()
  @MaxLength(100)
  username: string;

  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  @IsStrongPassword()
  password: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  roleIds?: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateUserEmployeeProfileDto)
  employeeProfile?: CreateUserEmployeeProfileDto;
}
