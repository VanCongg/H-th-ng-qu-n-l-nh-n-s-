import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";

export class AssignTaskDto {
  @Type(() => Number)
  @IsInt()
  assigneeId: number;

  @IsOptional()
  @IsString()
  note?: string;
}
