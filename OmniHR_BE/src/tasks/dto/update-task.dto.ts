// Dữ liệu sửa task: các trường của CreateTaskDto, đều không bắt buộc.

import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateTaskDto } from "./create-task.dto";

export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ["parentTaskId", "projectId", "teamId"] as const)
) {}
