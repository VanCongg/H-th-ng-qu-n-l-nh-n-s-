// API công việc (task): danh sách theo phạm vi (tất cả / team / của tôi), tạo, sửa, xóa, giao việc, đổi trạng thái.

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { AssignTaskDto } from "./dto/assign-task.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";
import { TasksService } from "./tasks.service";

@ApiTags("tasks")
@ApiBearerAuth()
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // Tất cả task người dùng được xem.
  @Permissions("TASK_READ_ALL")
  @Get()
  findAll(@Query() query: TaskQueryDto, @CurrentUser() user: AuthUser) {
    return this.tasksService.findAll(query, user);
  }

  // Task của team mình quản lý.
  @Permissions("TASK_READ_TEAM")
  @Get("team")
  findTeam(@Query() query: TaskQueryDto, @CurrentUser() user: AuthUser) {
    return this.tasksService.findTeam(query, user);
  }

  // Task được giao cho chính mình.
  @Permissions("TASK_READ_SELF")
  @Get("me")
  findSelf(@Query() query: TaskQueryDto, @CurrentUser() user: AuthUser) {
    return this.tasksService.findSelf(query, user);
  }

  // Chi tiết một task, kèm các trạng thái người dùng được phép chuyển tới.
  @Permissions("TASK_READ_ALL", "TASK_READ_TEAM", "TASK_READ_SELF")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.tasksService.getOne(id, user);
  }

  // Tạo task (task nhóm hoặc task con).
  @Permissions("TASK_CREATE")
  @Post()
  create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.tasksService.create(dto, user, context);
  }

  // Sửa thông tin task.
  @Permissions("TASK_UPDATE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.tasksService.update(id, dto, user, context);
  }

  // Xóa mềm task.
  @Permissions("TASK_DELETE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.tasksService.softDelete(id, user, context);
  }

  // Giao task cho một nhân viên (giao tay).
  @Permissions("TASK_ASSIGN")
  @Post(":id/assign")
  assign(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignTaskDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.tasksService.assign(id, dto, user, context);
  }

  // Đổi trạng thái task theo luật trong task-status-rules.ts.
  @Permissions("TASK_UPDATE_STATUS")
  @Patch(":id/status")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.tasksService.updateStatus(id, dto, user, context);
  }
}
