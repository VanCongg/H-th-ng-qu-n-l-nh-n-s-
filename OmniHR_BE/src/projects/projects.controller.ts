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
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectQueryDto } from "./dto/project-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService } from "./projects.service";

@ApiTags("projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Permissions("PROJECT_READ_ALL", "PROJECT_READ_TEAM")
  @Get()
  findAll(@Query() query: ProjectQueryDto, @CurrentUser() user: AuthUser) {
    return this.projectsService.findAll(query, user);
  }

  @Permissions("PROJECT_READ_ALL", "PROJECT_READ_TEAM")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.projectsService.findOne(id, user);
  }

  @Permissions("PROJECT_CREATE")
  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.projectsService.create(dto, user, context);
  }

  @Permissions("PROJECT_UPDATE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.projectsService.update(id, dto, user, context);
  }

  @Permissions("PROJECT_DELETE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.projectsService.softDelete(id, user, context);
  }
}
