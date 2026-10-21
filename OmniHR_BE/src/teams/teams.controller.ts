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
import { AddTeamMemberDto } from "./dto/add-team-member.dto";
import { CreateTeamDto } from "./dto/create-team.dto";
import { TeamQueryDto } from "./dto/team-query.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { UpdateTeamMemberDto } from "./dto/update-team-member.dto";
import { TeamsService } from "./teams.service";

@ApiTags("teams")
@ApiBearerAuth()
@Controller("teams")
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Permissions("TEAM_READ")
  @Get()
  findAll(@Query() query: TeamQueryDto, @CurrentUser() user: AuthUser) {
    return this.teamsService.findAll(query, user);
  }

  @Permissions("TEAM_READ")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.teamsService.findOne(id, user);
  }

  @Permissions("TEAM_CREATE")
  @Post()
  create(
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.teamsService.create(dto, user, context);
  }

  @Permissions("TEAM_UPDATE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.teamsService.update(id, dto, user, context);
  }

  @Permissions("TEAM_DELETE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.teamsService.softDelete(id, user, context);
  }

  @Permissions("TEAM_UPDATE")
  @Post(":id/members")
  addMember(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AddTeamMemberDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.teamsService.addMember(id, dto, user, context);
  }

  @Permissions("TEAM_UPDATE")
  @Patch(":id/members/:memberId")
  updateMember(
    @Param("id", ParseIntPipe) id: number,
    @Param("memberId", ParseIntPipe) memberId: number,
    @Body() dto: UpdateTeamMemberDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.teamsService.updateMember(id, memberId, dto, user, context);
  }

  @Permissions("TEAM_UPDATE")
  @Delete(":id/members/:memberId")
  removeMember(
    @Param("id", ParseIntPipe) id: number,
    @Param("memberId", ParseIntPipe) memberId: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.teamsService.removeMember(id, memberId, user, context);
  }
}
