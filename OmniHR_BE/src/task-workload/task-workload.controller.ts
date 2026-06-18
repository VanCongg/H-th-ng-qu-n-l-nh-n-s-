import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { AuthUser } from "../common/types";
import { TaskWorkloadQueryDto } from "./dto/task-workload-query.dto";
import { TaskWorkloadService } from "./task-workload.service";

@ApiTags("task-workload")
@ApiBearerAuth()
@Controller("task-workload")
export class TaskWorkloadController {
  constructor(private readonly workloadService: TaskWorkloadService) {}

  @Permissions("TASK_ASSIGNMENT_READ")
  @Get()
  findAll(@Query() query: TaskWorkloadQueryDto, @CurrentUser() user: AuthUser) {
    return this.workloadService.findAll(user, query);
  }
}
