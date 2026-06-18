"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const admin_attendance_dto_1 = require("./dto/admin-attendance.dto");
const attendance_action_dto_1 = require("./dto/attendance-action.dto");
const attendance_query_dto_1 = require("./dto/attendance-query.dto");
const attendance_service_1 = require("./attendance.service");
let AttendanceController = class AttendanceController {
    attendanceService;
    constructor(attendanceService) {
        this.attendanceService = attendanceService;
    }
    checkIn(dto, user, context) {
        return this.attendanceService.checkIn(user, dto, context);
    }
    checkOut(dto, user, context) {
        return this.attendanceService.checkOut(user, dto, context);
    }
    findAll(query) {
        return this.attendanceService.findAll(query);
    }
    findSelf(user, query) {
        return this.attendanceService.findSelf(user, query);
    }
    findTeam(user, query) {
        return this.attendanceService.findTeam(user, query);
    }
    findByEmployee(employeeId, user, query) {
        return this.attendanceService.findByEmployee(employeeId, user, query);
    }
    adminCreate(dto, user, context) {
        return this.attendanceService.adminCreate(dto, user, context);
    }
    adminUpdate(id, dto, user, context) {
        return this.attendanceService.adminUpdate(id, dto, user, context);
    }
};
exports.AttendanceController = AttendanceController;
__decorate([
    (0, permissions_decorator_1.Permissions)("ATTENDANCE_CHECK_IN"),
    (0, common_1.Post)("check-in"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [attendance_action_dto_1.AttendanceActionDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "checkIn", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ATTENDANCE_CHECK_OUT"),
    (0, common_1.Post)("check-out"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [attendance_action_dto_1.AttendanceActionDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "checkOut", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ATTENDANCE_READ_ALL"),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [attendance_query_dto_1.AttendanceQueryDto]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "findAll", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ATTENDANCE_READ_SELF"),
    (0, common_1.Get)("self"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_query_dto_1.AttendanceQueryDto]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "findSelf", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ATTENDANCE_READ_TEAM"),
    (0, common_1.Get)("team"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_query_dto_1.AttendanceQueryDto]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "findTeam", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ATTENDANCE_READ_ALL", "ATTENDANCE_READ_TEAM", "ATTENDANCE_READ_SELF"),
    (0, common_1.Get)("employee/:employeeId"),
    __param(0, (0, common_1.Param)("employeeId", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, attendance_query_dto_1.AttendanceQueryDto]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "findByEmployee", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ATTENDANCE_ADJUST"),
    (0, common_1.Post)("admin"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_attendance_dto_1.AdminCreateAttendanceDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "adminCreate", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ATTENDANCE_ADJUST"),
    (0, common_1.Patch)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, admin_attendance_dto_1.AdminUpdateAttendanceDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "adminUpdate", null);
exports.AttendanceController = AttendanceController = __decorate([
    (0, swagger_1.ApiTags)("attendance"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("attendance"),
    __metadata("design:paramtypes", [attendance_service_1.AttendanceService])
], AttendanceController);
//# sourceMappingURL=attendance.controller.js.map