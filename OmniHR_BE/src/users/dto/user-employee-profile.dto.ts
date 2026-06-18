import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { CareerLevel, EmployeeStatus } from "@prisma/client";

export class CreateUserEmployeeProfileDto {
  @IsString()
  @MaxLength(50)
  employeeCode: string;

  @IsString()
  @MaxLength(160)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000000)
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
  @MaxLength(1000000)
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
