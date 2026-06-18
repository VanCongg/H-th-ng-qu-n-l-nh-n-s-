import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { CareerLevel, EmployeeStatus } from "@prisma/client";

export class CreateEmployeeDto {
  @IsString()
  @MaxLength(50)
  employeeCode: string;

  @IsString()
  @MaxLength(160)
  fullName: string;

  @IsEmail()
  @MaxLength(160)
  companyEmail: string;

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

  @IsDateString()
  birthDate: string;

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
