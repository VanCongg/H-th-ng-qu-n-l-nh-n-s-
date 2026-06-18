import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { AuthUser } from "../common/types";
import { TaskAssignmentQueryDto } from "./dto/task-assignment-query.dto";
import { TaskAssignmentsService } from "./task-assignments.service";

@ApiTags("task-assignments")
@ApiBearerAuth()
@Controller("task-assignments")
export class TaskAssignmentsController {
  constructor(private readonly assignmentsService: TaskAssignmentsService) {}

  @Permissions("TASK_ASSIGNMENT_READ")
  @Get()
  findAll(
    @Query() query: TaskAssignmentQueryDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.assignmentsService.findAll(query, user);
  }
}
