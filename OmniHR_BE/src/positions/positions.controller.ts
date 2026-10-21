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
import { CreatePositionDto } from "./dto/create-position.dto";
import { UpdatePositionDto } from "./dto/update-position.dto";
import { PositionsService } from "./positions.service";

@ApiTags("positions")
@ApiBearerAuth()
@Controller("positions")
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Permissions("POSITION_READ")
  @Get()
  findAll(
    @Query("search") search?: string,
    @Query("departmentId") departmentId?: string
  ) {
    return this.positionsService.findAll(
      search,
      departmentId ? Number(departmentId) : undefined
    );
  }

  @Permissions("POSITION_READ")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.positionsService.findOne(id);
  }

  @Permissions("POSITION_CREATE")
  @Post()
  create(
    @Body() dto: CreatePositionDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.positionsService.create(dto, user, context);
  }

  @Permissions("POSITION_UPDATE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePositionDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.positionsService.update(id, dto, user, context);
  }

  @Permissions("POSITION_DELETE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.positionsService.softDelete(id, user, context);
  }
}
