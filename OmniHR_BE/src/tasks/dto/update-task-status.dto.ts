// Dữ liệu đổi trạng thái task: trạng thái mới và ghi chú.

import { IsEnum, IsOptional, IsString } from "class-validator";
import { TaskStatus } from "@prisma/client";

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
