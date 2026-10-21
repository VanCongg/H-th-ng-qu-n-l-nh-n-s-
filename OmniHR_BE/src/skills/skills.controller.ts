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
import { CreateSkillDto } from "./dto/create-skill.dto";
import { SkillQueryDto } from "./dto/skill-query.dto";
import { UpdateSkillDto } from "./dto/update-skill.dto";
import { SkillsService } from "./skills.service";

@ApiTags("skills")
@ApiBearerAuth()
@Controller("skills")
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Permissions("SKILL_READ")
  @Get()
  findAll(@Query() query: SkillQueryDto) {
    return this.skillsService.findAll(query);
  }

  @Permissions("SKILL_READ")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.skillsService.findOne(id);
  }

  @Permissions("SKILL_CREATE")
  @Post()
  create(
    @Body() dto: CreateSkillDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.skillsService.create(dto, user, context);
  }

  @Permissions("SKILL_UPDATE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSkillDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.skillsService.update(id, dto, user, context);
  }

  @Permissions("SKILL_DELETE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.skillsService.remove(id, user, context);
  }
}
