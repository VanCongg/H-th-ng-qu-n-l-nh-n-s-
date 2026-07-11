"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const Joi = __importStar(require("joi"));
const ai_task_suggestions_module_1 = require("./ai-task-suggestions/ai-task-suggestions.module");
const audit_logs_module_1 = require("./audit-logs/audit-logs.module");
const attendance_module_1 = require("./attendance/attendance.module");
const auth_module_1 = require("./auth/auth.module");
const chatbot_module_1 = require("./chatbot/chatbot.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
const permissions_guard_1 = require("./common/guards/permissions.guard");
const roles_guard_1 = require("./common/guards/roles.guard");
const response_interceptor_1 = require("./common/interceptors/response.interceptor");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const departments_module_1 = require("./departments/departments.module");
const employee_managers_module_1 = require("./employee-managers/employee-managers.module");
const employee_skills_module_1 = require("./employee-skills/employee-skills.module");
const employees_module_1 = require("./employees/employees.module");
const leave_requests_module_1 = require("./leave-requests/leave-requests.module");
const leave_types_module_1 = require("./leave-types/leave-types.module");
const permissions_module_1 = require("./permissions/permissions.module");
const positions_module_1 = require("./positions/positions.module");
const prisma_module_1 = require("./prisma/prisma.module");
const projects_module_1 = require("./projects/projects.module");
const roles_module_1 = require("./roles/roles.module");
const skills_module_1 = require("./skills/skills.module");
const task_assignments_module_1 = require("./task-assignments/task-assignments.module");
const task_workload_module_1 = require("./task-workload/task-workload.module");
const tasks_module_1 = require("./tasks/tasks.module");
const teams_module_1 = require("./teams/teams.module");
const users_module_1 = require("./users/users.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                validationSchema: Joi.object({
                    NODE_ENV: Joi.string()
                        .valid("development", "test", "production")
                        .default("development"),
                    PORT: Joi.number().default(3000),
                    DATABASE_URL: Joi.string().required(),
                    JWT_ACCESS_SECRET: Joi.string().min(12).required(),
                    JWT_REFRESH_SECRET: Joi.string().min(12).required(),
                    JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
                    JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),
                    BCRYPT_SALT_ROUNDS: Joi.number().default(10),
                    DEFAULT_ADMIN_USERNAME: Joi.string().default("admin"),
                    DEFAULT_ADMIN_EMAIL: Joi.string()
                        .email({ tlds: { allow: false } })
                        .default("admin@corehr.local"),
                    DEFAULT_ADMIN_PASSWORD: Joi.string().min(8).default("Admin@123456"),
                    CORS_ORIGIN: Joi.string().default("http://localhost:5173"),
                    AI_SERVICE_URL: Joi.string().default("http://localhost:8000"),
                    AI_INTERNAL_TOKEN: Joi.string().min(6).default("change-me"),
                    AI_TIMEOUT_MS: Joi.number().default(30000),
                    CHATBOT_RATE_LIMIT_TTL_SECONDS: Joi.number().default(60),
                    CHATBOT_RATE_LIMIT_MAX: Joi.number().default(20),
                    CHATBOT_RATE_LIMIT_PER_MINUTE: Joi.number().default(20),
                    CHATBOT_HISTORY_LIMIT: Joi.number().default(12),
                    CHATBOT_MAX_MESSAGE_LENGTH: Joi.number().default(1000),
                    CHATBOT_PENDING_ACTION_TTL_MINUTES: Joi.number().default(30),
                }),
            }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60000,
                    limit: 100,
                },
            ]),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            dashboard_module_1.DashboardModule,
            users_module_1.UsersModule,
            roles_module_1.RolesModule,
            permissions_module_1.PermissionsModule,
            departments_module_1.DepartmentsModule,
            positions_module_1.PositionsModule,
            employees_module_1.EmployeesModule,
            employee_managers_module_1.EmployeeManagersModule,
            attendance_module_1.AttendanceModule,
            leave_types_module_1.LeaveTypesModule,
            leave_requests_module_1.LeaveRequestsModule,
            audit_logs_module_1.AuditLogsModule,
            projects_module_1.ProjectsModule,
            skills_module_1.SkillsModule,
            employee_skills_module_1.EmployeeSkillsModule,
            teams_module_1.TeamsModule,
            tasks_module_1.TasksModule,
            task_assignments_module_1.TaskAssignmentsModule,
            task_workload_module_1.TaskWorkloadModule,
            ai_task_suggestions_module_1.AiTaskSuggestionsModule,
            chatbot_module_1.ChatbotModule,
        ],
        providers: [
            {
                provide: core_1.APP_FILTER,
                useClass: http_exception_filter_1.HttpExceptionFilter,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: response_interceptor_1.ResponseInterceptor,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: jwt_auth_guard_1.JwtAuthGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: roles_guard_1.RolesGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: permissions_guard_1.PermissionsGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map