import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { AttendanceRecordType } from "@prisma/client";

export class AdminCreateAttendanceDto {
  @IsInt()
  employeeId: number;

  @IsDateString()
  workDate: string;

  @IsEnum(AttendanceRecordType)
  recordType: AttendanceRecordType;

  @IsDateString()
  recordedAt: string;

  @IsString()
  @MaxLength(500)
  note: string;
}

export class AdminUpdateAttendanceDto {
  @IsOptional()
  @IsDateString()
  workDate?: string;

  @IsOptional()
  @IsEnum(AttendanceRecordType)
  recordType?: AttendanceRecordType;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
