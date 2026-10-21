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
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { DepartmentsService } from "./departments.service";

@ApiTags("departments")
@ApiBearerAuth()
@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Permissions("DEPARTMENT_READ")
  @Get()
  findAll(@Query("search") search?: string) {
    return this.departmentsService.findAll(search);
  }

  @Permissions("DEPARTMENT_READ")
  @Get("tree")
  tree() {
    return this.departmentsService.tree();
  }

  @Permissions("DEPARTMENT_READ")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.departmentsService.findOne(id);
  }

  @Permissions("DEPARTMENT_CREATE")
  @Post()
  create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.departmentsService.create(dto, user, context);
  }

  @Permissions("DEPARTMENT_UPDATE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.departmentsService.update(id, dto, user, context);
  }

  @Permissions("DEPARTMENT_DELETE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.departmentsService.softDelete(id, user, context);
  }
}
