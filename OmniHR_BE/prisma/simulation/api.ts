import { ConsoleLogger, INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { AiTaskSuggestionsService } from "../../src/ai-task-suggestions/ai-task-suggestions.service";
import { AppModule } from "../../src/app.module";
import { AttendanceService } from "../../src/attendance/attendance.service";
import { AuthService } from "../../src/auth/auth.service";
import { ChatbotService } from "../../src/chatbot/chatbot.service";
import { AuthUser, RequestContext } from "../../src/common/types";
import { DashboardService } from "../../src/dashboard/dashboard.service";
import { LeaveRequestsService } from "../../src/leave-requests/leave-requests.service";
import { NotificationsGateway } from "../../src/notifications/notifications.gateway";
import { NotificationsService } from "../../src/notifications/notifications.service";
import { PrismaService } from "../../src/prisma/prisma.service";
import { ProjectsService } from "../../src/projects/projects.service";
import { TasksService } from "../../src/tasks/tasks.service";
import { withSimulatedTimestamps } from "./timestamps";

/**
 * The API as the simulated people use it: the same services the controllers
 * call, with the same permission checks, validation, audit log, notifications
 * and cache invalidation. Nothing here writes to the database by itself.
 */
export type SimulationApi = {
  prisma: ReturnType<typeof withSimulatedTimestamps>;
  attendance: AttendanceService;
  leave: LeaveRequestsService;
  projects: ProjectsService;
  tasks: TasksService;
  suggestions: AiTaskSuggestionsService;
  chatbot: ChatbotService;
  notifications: NotificationsService;
  dashboard: DashboardService;
  /** The signed-in session of a user, as the JWT strategy would build it. */
  actor(userId: number): Promise<AuthUser>;
  /** What the audit log records about where a request came from. */
  from(device: "mobile" | "web"): RequestContext;
  close(): Promise<void>;
};

const DEVICES: Record<"mobile" | "web", RequestContext> = {
  mobile: { ip: "10.0.1.24", userAgent: "OmniHR-App/1.0 (Android 14)" },
  web: {
    ip: "10.0.1.8",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"
  }
};

export async function startSimulationApi(): Promise<SimulationApi> {
  const client = withSimulatedTimestamps(new PrismaClient());
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(client)
    // No HTTP server, so no socket to push to: nobody is online in the past.
    // The notification row itself is still written, as it is for anyone offline.
    .overrideProvider(NotificationsGateway)
    .useValue({ emitToUser: () => undefined })
    .setLogger(new ConsoleLogger({ logLevels: ["error", "warn"] }))
    .compile();
  const app: INestApplicationContext = await moduleRef.init();

  const auth = app.get(AuthService);
  const sessions = new Map<number, AuthUser>();

  return {
    prisma: client,
    attendance: app.get(AttendanceService),
    leave: app.get(LeaveRequestsService),
    projects: app.get(ProjectsService),
    tasks: app.get(TasksService),
    suggestions: app.get(AiTaskSuggestionsService),
    chatbot: app.get(ChatbotService),
    notifications: app.get(NotificationsService),
    dashboard: app.get(DashboardService),
    async actor(userId: number) {
      const cached = sessions.get(userId);
      if (cached) {
        return cached;
      }
      const user = await auth.hydrateAuthUser(userId);
      if (!user) {
        throw new Error(`User ${userId} cannot sign in`);
      }
      sessions.set(userId, user);
      return user;
    },
    from(device) {
      return DEVICES[device];
    },
    async close() {
      await app.close();
      await client.$disconnect();
    }
  };
}
