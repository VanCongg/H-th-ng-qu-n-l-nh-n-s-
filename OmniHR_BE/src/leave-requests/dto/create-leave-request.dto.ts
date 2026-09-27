import { LeaveHalf } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateLeaveRequestDto {
  @IsInt()
  leaveTypeId: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @MaxLength(1000)
  reason: string;

  /** Only the morning or the afternoon: a one-day request costing 0.5 day. */
  @IsOptional()
  @IsEnum(LeaveHalf)
  halfDay?: LeaveHalf;
}
