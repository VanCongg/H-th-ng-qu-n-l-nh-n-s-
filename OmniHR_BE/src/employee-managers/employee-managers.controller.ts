import {
  Body,
  Controller,
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
import { AssignManagerDto } from "./dto/assign-manager.dto";
import { EndManagerDto } from "./dto/end-manager.dto";
import { EmployeeManagersService } from "./employee-managers.service";

@ApiTags("employee-managers")
@ApiBearerAuth()
@Controller("employee-managers")
export class EmployeeManagersController {
  constructor(private readonly employeeManagersService: EmployeeManagersService) {}

  @Permissions("MANAGER_READ")
  @Get()
  findAll() {
    return this.employeeManagersService.findAll();
  }

  @Permissions("MANAGER_READ")
  @Get("employee/:employeeId")
  findByEmployee(@Param("employeeId", ParseIntPipe) employeeId: number) {
    return this.employeeManagersService.findByEmployee(employeeId);
  }

  @Permissions("MANAGER_READ")
  @Get("manager/:managerId/subordinates")
  findSubordinates(@Param("managerId", ParseIntPipe) managerId: number) {
    return this.employeeManagersService.findSubordinates(managerId);
  }

  @Permissions("MANAGER_ASSIGN")
  @Post()
  assign(
    @Body() dto: AssignManagerDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeeManagersService.assign(dto, user, context);
  }

  @Permissions("MANAGER_REMOVE")
  @Patch(":id/end")
  end(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: EndManagerDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeeManagersService.end(id, dto, user, context);
  }
}
