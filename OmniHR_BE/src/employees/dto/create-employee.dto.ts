import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { EmployeeStatus } from "@prisma/client";

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
}
