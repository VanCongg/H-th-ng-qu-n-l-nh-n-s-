import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import * as Joi from "joi";
import { AiTaskSuggestionsModule } from "./ai-task-suggestions/ai-task-suggestions.module";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AuthModule } from "./auth/auth.module";
import { ChatbotModule } from "./chatbot/chatbot.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DepartmentsModule } from "./departments/departments.module";
import { EmployeeManagersModule } from "./employee-managers/employee-managers.module";
import { EmployeeSkillsModule } from "./employee-skills/employee-skills.module";
import { EmployeesModule } from "./employees/employees.module";
import { LeaveRequestsModule } from "./leave-requests/leave-requests.module";
import { LeaveTypesModule } from "./leave-types/leave-types.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { PositionsModule } from "./positions/positions.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./projects/projects.module";
import { RolesModule } from "./roles/roles.module";
import { SkillsModule } from "./skills/skills.module";
import { TaskAssignmentsModule } from "./task-assignments/task-assignments.module";
import { TaskWorkloadModule } from "./task-workload/task-workload.module";
import { TasksModule } from "./tasks/tasks.module";
import { TeamsModule } from "./teams/teams.module";
import { UsersModule } from "./users/users.module";

const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const insecureProductionValues = new Map<string, string[]>([
  ["JWT_ACCESS_SECRET", ["change_me_access_secret"]],
  ["JWT_REFRESH_SECRET", ["change_me_refresh_secret"]],
  ["AI_INTERNAL_TOKEN", ["change-me"]],
  ["DEFAULT_ADMIN_PASSWORD", ["Admin@123456"]],
]);

function rejectInsecureProductionConfig(
  env: Record<string, unknown>,
  helpers: Joi.CustomHelpers
) {
  if (env.NODE_ENV !== "production") {
    return env;
  }

  for (const [key, blockedValues] of insecureProductionValues.entries()) {
    const value = String(env[key] ?? "");
    if (blockedValues.includes(value) || value.startsWith("replace-with-")) {
      return helpers.error("any.invalid");
    }
  }

  if (String(env.CORS_ORIGIN ?? "").includes("*")) {
    return helpers.error("any.invalid");
  }

  return env;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid("development", "test", "production")
          .default("development"),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),
        BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(14).default(10),
        DEFAULT_ADMIN_USERNAME: Joi.string().default("admin"),
        DEFAULT_ADMIN_EMAIL: Joi.string()
          .email({ tlds: { allow: false } })
          .default("admin@corehr.local"),
        DEFAULT_ADMIN_PASSWORD: Joi.string()
          .min(12)
          .pattern(strongPasswordPattern)
          .default("Admin@123456"),
        CORS_ORIGIN: Joi.string().default("http://localhost:5173"),
        AI_SERVICE_URL: Joi.string().default("http://localhost:8000"),
        AI_INTERNAL_TOKEN: Joi.string().min(32).required(),
        AI_TIMEOUT_MS: Joi.number().default(30000),
        CHATBOT_RATE_LIMIT_TTL_SECONDS: Joi.number().default(60),
        CHATBOT_RATE_LIMIT_MAX: Joi.number().default(20),
        CHATBOT_RATE_LIMIT_PER_MINUTE: Joi.number().default(20),
        CHATBOT_HISTORY_LIMIT: Joi.number().default(12),
        CHATBOT_MAX_MESSAGE_LENGTH: Joi.number().default(1000),
        CHATBOT_PENDING_ACTION_TTL_MINUTES: Joi.number().default(30),
      })
        .custom(rejectInsecureProductionConfig, "production security guard")
        .messages({
          "any.invalid": "Production config must not use insecure default secrets",
        }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    DashboardModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    DepartmentsModule,
    PositionsModule,
    EmployeesModule,
    EmployeeManagersModule,
    AttendanceModule,
    LeaveTypesModule,
    LeaveRequestsModule,
    AuditLogsModule,
    ProjectsModule,
    SkillsModule,
    EmployeeSkillsModule,
    TeamsModule,
    TasksModule,
    TaskAssignmentsModule,
    TaskWorkloadModule,
    AiTaskSuggestionsModule,
    ChatbotModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
