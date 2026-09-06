import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { CareerLevel, EmployeeStatus } from "@prisma/client";
import {
  IsSafeAvatar,
  MAX_AVATAR_VALUE_LENGTH
} from "../../common/validators/avatar";

export class CreateUserEmployeeProfileDto {
  @IsString()
  @MaxLength(50)
  employeeCode: string;

  @IsString()
  @MaxLength(160)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_AVATAR_VALUE_LENGTH)
  @IsSafeAvatar()
  avatarUrl?: string | null;

  @IsDateString()
  birthDate: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsInt()
  departmentId: number;

  @IsInt()
  positionId: number;

  @IsOptional()
  @IsEnum(CareerLevel)
  careerLevel?: CareerLevel;
}

export class UpdateUserEmployeeProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_AVATAR_VALUE_LENGTH)
  @IsSafeAvatar()
  avatarUrl?: string | null;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsInt()
  positionId?: number;

  @IsOptional()
  @IsEnum(CareerLevel)
  careerLevel?: CareerLevel;
}
