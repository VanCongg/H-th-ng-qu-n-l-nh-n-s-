import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import {
  CompensationQueryDto,
  CreatePayrollPeriodDto,
  SendPayslipsDto,
  UpsertCompensationDto
} from "./dto/payroll.dto";
import { PayrollService } from "./payroll.service";

@ApiTags("payroll")
@ApiBearerAuth()
@Controller("payroll")
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Permissions("PAYROLL_READ")
  @Get("compensations")
  listCompensations(@Query() query: CompensationQueryDto) {
    return this.payrollService.listCompensations(query);
  }

  @Permissions("PAYROLL_MANAGE")
  @Put("compensations/:employeeId")
  upsertCompensation(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Body() dto: UpsertCompensationDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.payrollService.upsertCompensation(employeeId, dto, user, context);
  }

  @Permissions("PAYROLL_READ")
  @Get("periods")
  listPeriods() {
    return this.payrollService.listPeriods();
  }

  @Permissions("PAYROLL_MANAGE")
  @Post("periods")
  createPeriod(
    @Body() dto: CreatePayrollPeriodDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.payrollService.createPeriod(dto, user, context);
  }

  @Permissions("PAYROLL_READ")
  @Get("periods/:id")
  getPeriod(@Param("id", ParseIntPipe) id: number) {
    return this.payrollService.getPeriod(id);
  }

  @Permissions("PAYROLL_MANAGE")
  @Post("periods/:id/calculate")
  calculate(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.payrollService.calculate(id, user, context);
  }

  @Permissions("PAYROLL_MANAGE")
  @Post("periods/:id/finalize")
  finalize(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.payrollService.finalize(id, user, context);
  }

  @Permissions("PAYROLL_MANAGE")
  @Post("periods/:id/send-payslips")
  sendPayslips(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SendPayslipsDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.payrollService.sendPayslips(id, dto, user, context);
  }

  @Permissions("PAYROLL_MANAGE")
  @Delete("periods/:id")
  removePeriod(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.payrollService.removePeriod(id, user, context);
  }
}
