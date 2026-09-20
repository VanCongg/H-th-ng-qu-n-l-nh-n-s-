import {
  Body,
  Controller,
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
import {
  AdminCreateAttendanceDto,
  AdminUpdateAttendanceDto
} from "./dto/admin-attendance.dto";
import { AttendanceActionDto } from "./dto/attendance-action.dto";
import { AttendanceQueryDto } from "./dto/attendance-query.dto";
import { TimesheetQueryDto } from "./dto/timesheet-query.dto";
import { AttendanceService } from "./attendance.service";
import { TimesheetService } from "./timesheet.service";

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("attendance")
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly timesheetService: TimesheetService
  ) {}

  @Permissions("ATTENDANCE_CHECK_IN")
  @Get("location-policy")
  getLocationPolicy() {
    return this.attendanceService.getLocationPolicy();
  }

  @Permissions("ATTENDANCE_CHECK_IN")
  @Post("check-in")
  checkIn(
    @Body() dto: AttendanceActionDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.attendanceService.checkIn(user, dto, context);
  }

  @Permissions("ATTENDANCE_CHECK_OUT")
  @Post("check-out")
  checkOut(
    @Body() dto: AttendanceActionDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.attendanceService.checkOut(user, dto, context);
  }

  @Permissions("ATTENDANCE_READ_ALL")
  @Get()
  findAll(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.findAll(query);
  }

  @Permissions("ATTENDANCE_READ_ALL")
  @Get("timesheets")
  findTimesheets(@Query() query: TimesheetQueryDto) {
    return this.timesheetService.list(query);
  }

  @Permissions("ATTENDANCE_READ_SELF")
  @Get("self")
  findSelf(@CurrentUser() user: AuthUser, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.findSelf(user, query);
  }

  @Permissions("ATTENDANCE_READ_TEAM")
  @Get("team")
  findTeam(@CurrentUser() user: AuthUser, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.findTeam(user, query);
  }

  @Permissions("ATTENDANCE_READ_ALL", "ATTENDANCE_READ_TEAM", "ATTENDANCE_READ_SELF")
  @Get("employee/:employeeId")
  findByEmployee(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @CurrentUser() user: AuthUser,
    @Query() query: AttendanceQueryDto
  ) {
    return this.attendanceService.findByEmployee(employeeId, user, query);
  }

  @Permissions("ATTENDANCE_ADJUST")
  @Post("admin")
  adminCreate(
    @Body() dto: AdminCreateAttendanceDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.attendanceService.adminCreate(dto, user, context);
  }

  @Permissions("ATTENDANCE_ADJUST")
  @Patch(":id")
  adminUpdate(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AdminUpdateAttendanceDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.attendanceService.adminUpdate(id, dto, user, context);
  }
}
