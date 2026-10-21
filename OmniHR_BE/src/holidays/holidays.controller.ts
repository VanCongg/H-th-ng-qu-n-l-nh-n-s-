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
import { HolidaysService } from "../common/services/holidays.service";
import { AuthUser, RequestContext } from "../common/types";
import { CreateHolidayDto, HolidayQueryDto, UpdateHolidayDto } from "./dto/holiday.dto";

@ApiTags("holidays")
@ApiBearerAuth()
@Controller("holidays")
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  /** Open to every signed-in user: the mobile calendar marks these days. */
  @Get()
  findAll(@Query() query: HolidayQueryDto) {
    return this.holidays.list(query.year);
  }

  @Permissions("SYSTEM_SETTING_UPDATE")
  @Post()
  create(
    @Body() dto: CreateHolidayDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.holidays.create(dto, user, context);
  }

  @Permissions("SYSTEM_SETTING_UPDATE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateHolidayDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.holidays.update(id, dto, user, context);
  }

  @Permissions("SYSTEM_SETTING_UPDATE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.holidays.remove(id, user, context);
  }
}
