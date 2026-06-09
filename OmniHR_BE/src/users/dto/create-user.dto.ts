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
  password: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  roleIds?: number[];
}
