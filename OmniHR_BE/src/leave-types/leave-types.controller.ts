import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto";
import { LeaveTypesService } from "./leave-types.service";

@ApiTags("leave-types")
@ApiBearerAuth()
@Controller("leave-types")
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @Permissions("LEAVE_TYPE_READ")
  @Get()
  findAll() {
    return this.leaveTypesService.findAll();
  }

  @Permissions("LEAVE_TYPE_READ")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.leaveTypesService.findOne(id);
  }

  @Permissions("LEAVE_TYPE_CREATE")
  @Post()
  create(
    @Body() dto: CreateLeaveTypeDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveTypesService.create(dto, user, context);
  }

  @Permissions("LEAVE_TYPE_UPDATE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateLeaveTypeDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveTypesService.update(id, dto, user, context);
  }

  @Permissions("LEAVE_TYPE_DELETE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveTypesService.remove(id, user, context);
  }
}
