import { IsDateString, IsInt, IsString, MaxLength } from "class-validator";

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
}
