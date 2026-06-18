import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import * as Joi from "joi";
import { AiTaskSuggestionsModule } from "./ai-task-suggestions/ai-task-suggestions.module";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AuthModule } from "./auth/auth.module";
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
        CORS_ORIGIN: Joi.string().default("http://localhost:5173")
      })
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100
      }
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
    AiTaskSuggestionsModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard
    }
  ]
})
export class AppModule {}
