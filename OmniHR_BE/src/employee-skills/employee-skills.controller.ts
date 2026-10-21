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
import { CreateEmployeeSkillDto } from "./dto/create-employee-skill.dto";
import { UpdateEmployeeSkillDto } from "./dto/update-employee-skill.dto";
import { EmployeeSkillsService } from "./employee-skills.service";

@ApiTags("employee-skills")
@ApiBearerAuth()
@Controller()
export class EmployeeSkillsController {
  constructor(private readonly employeeSkillsService: EmployeeSkillsService) {}

  @Permissions("EMPLOYEE_SKILL_READ")
  @Get("employees/:employeeId/skills")
  findByEmployee(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @CurrentUser() user: AuthUser
  ) {
    return this.employeeSkillsService.findByEmployee(employeeId, user);
  }

  @Permissions("EMPLOYEE_SKILL_CREATE")
  @Post("employees/:employeeId/skills")
  create(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Body() dto: CreateEmployeeSkillDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeeSkillsService.create(employeeId, dto, user, context);
  }

  @Permissions("EMPLOYEE_SKILL_UPDATE")
  @Patch("employee-skills/:id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeSkillDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeeSkillsService.update(id, dto, user, context);
  }

  @Permissions("EMPLOYEE_SKILL_DELETE")
  @Delete("employee-skills/:id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeeSkillsService.remove(id, user, context);
  }
}
