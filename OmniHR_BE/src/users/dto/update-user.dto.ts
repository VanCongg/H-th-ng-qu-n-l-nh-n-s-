import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password?: string;

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
}
