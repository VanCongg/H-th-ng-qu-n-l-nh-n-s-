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
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { Permissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Permissions("USER_READ")
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @Permissions("USER_READ")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Permissions("USER_CREATE")
  @Post()
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.usersService.create(dto, user, context);
  }

  @Permissions("USER_UPDATE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.usersService.update(id, dto, user, context);
  }

  @Permissions("USER_DELETE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.usersService.softDelete(id, user, context);
  }

  @Permissions("ROLE_ASSIGN")
  @Post(":id/roles")
  assignRole(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.usersService.assignRole(id, dto, user, context);
  }

  @Permissions("ROLE_ASSIGN")
  @Delete(":id/roles/:roleId")
  removeRole(
    @Param("id", ParseIntPipe) id: number,
    @Param("roleId", ParseIntPipe) roleId: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.usersService.removeRole(id, roleId, user, context);
  }

  @Permissions("USER_UPDATE")
  @Post(":id/reset-password")
  resetPassword(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.usersService.resetPassword(id, dto, user, context);
  }
}
