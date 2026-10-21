// API hồ sơ nhân viên: danh sách, cấp dưới, hồ sơ của tôi, tạo / sửa / xóa,
// đặt lại mật khẩu, khóa / mở khóa tài khoản.

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
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { UpdateSelfEmployeeDto } from "./dto/update-self-employee.dto";
import { EmployeesService } from "./employees.service";

@ApiTags("employees")
@ApiBearerAuth()
@Controller("employees")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // Danh sách nhân viên (HR / admin).
  @Permissions("EMPLOYEE_READ_ALL")
  @Get()
  findAll(@Query() query: EmployeeQueryDto) {
    return this.employeesService.findAll(query);
  }

  // Danh sách cấp dưới của người đang đăng nhập.
  @Permissions("EMPLOYEE_READ_TEAM")
  @Get("team")
  findTeam(@CurrentUser() user: AuthUser, @Query() query: EmployeeQueryDto) {
    return this.employeesService.findTeam(user, query);
  }

  // Hồ sơ của chính mình.
  @Permissions("EMPLOYEE_READ_SELF")
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.employeesService.myProfile(user);
  }

  // Tự sửa hồ sơ; đổi số điện thoại hoặc email cần mã OTP gửi qua email.
  @Permissions("EMPLOYEE_UPDATE_SELF")
  @Patch("me")
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSelfEmployeeDto,
    @ReqContext() context: RequestContext
  ) {
    return this.employeesService.updateSelf(user, dto, context);
  }

  // Hồ sơ một nhân viên (kiểm tra quyền xem).
  @Permissions("EMPLOYEE_READ_ALL", "EMPLOYEE_READ_TEAM", "EMPLOYEE_READ_SELF")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.employeesService.findOne(id, user);
  }

  // Tạo nhân viên mới, đồng thời tạo tài khoản đăng nhập.
  @Permissions("EMPLOYEE_CREATE")
  @Post()
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeesService.create(dto, user, context);
  }

  // HR / admin sửa hồ sơ nhân viên (không cần OTP).
  @Permissions("EMPLOYEE_UPDATE_ALL")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeesService.update(id, dto, user, context);
  }

  // Xóa mềm nhân viên.
  @Permissions("EMPLOYEE_DELETE")
  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeesService.softDelete(id, user, context);
  }

  // Đặt lại mật khẩu về mặc định (ngày sinh dd/mm/yyyy), bắt buộc đổi khi đăng nhập.
  @Permissions("EMPLOYEE_UPDATE_ALL")
  @Post(":id/reset-password")
  resetPassword(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeesService.resetPassword(id, user, context);
  }

  // Khóa tài khoản đăng nhập của nhân viên.
  @Permissions("EMPLOYEE_UPDATE_ALL")
  @Post(":id/lock-user")
  lockUser(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeesService.setUserActive(id, false, user, context);
  }

  // Mở khóa tài khoản đăng nhập của nhân viên.
  @Permissions("EMPLOYEE_UPDATE_ALL")
  @Post(":id/unlock-user")
  unlockUser(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.employeesService.setUserActive(id, true, user, context);
  }
}
