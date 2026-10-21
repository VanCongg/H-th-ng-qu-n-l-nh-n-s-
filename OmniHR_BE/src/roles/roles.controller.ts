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
import { AssignPermissionDto } from "./dto/assign-permission.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RolesService } from "./roles.service";

@ApiTags("roles")
@ApiBearerAuth()
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Permissions("ROLE_READ")
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Permissions("ROLE_READ")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Permissions("ROLE_CREATE")
  @Post()
  create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.rolesService.create(dto, user, context);
  }

  @Permissions("ROLE_UPDATE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.rolesService.update(id, dto, user, context);
  }

  @Permissions("ROLE_DELETE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.rolesService.remove(id, user, context);
  }

  @Permissions("PERMISSION_ASSIGN")
  @Post(":id/permissions")
  assignPermission(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignPermissionDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.rolesService.assignPermission(id, dto, user, context);
  }

  @Permissions("PERMISSION_ASSIGN")
  @Delete(":id/permissions/:permissionId")
  removePermission(
    @Param("id", ParseIntPipe) id: number,
    @Param("permissionId", ParseIntPipe) permissionId: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.rolesService.removePermission(id, permissionId, user, context);
  }
}
