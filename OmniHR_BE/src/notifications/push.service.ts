import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Notification } from "@prisma/client";
import { App, cert, deleteApp, initializeApp, ServiceAccount } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { PrismaService } from "../prisma/prisma.service";
import { PushLanguage, pushText } from "./push-text";

/** FCM answers these for a token that will never work again. */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token"
]);

/**
 * Sends notifications to the user's phones through Firebase Cloud Messaging.
 * Optional like Redis: with FIREBASE_SERVICE_ACCOUNT_JSON unset (or invalid)
 * it sends nothing, and the notification still reaches the bell and the app's
 * list. A failed push never fails the request that caused it.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private app: App | null | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async registerDevice(userId: number, token: string, platform: string, language: PushLanguage) {
    // A token belongs to one app install; whoever signed in on it last owns it.
    return this.prisma.pushDevice.upsert({
      where: { token },
      create: { userId, token, platform, language },
      update: { userId, platform, language },
      select: { id: true, platform: true, language: true }
    });
  }

  async removeDevice(userId: number, token: string) {
    await this.prisma.pushDevice.deleteMany({ where: { userId, token } });
  }

  async send(notification: Notification) {
    const app = this.firebase();
    if (!app) {
      return;
    }
    try {
      const devices = await this.prisma.pushDevice.findMany({
        where: { userId: notification.userId },
        select: { token: true, language: true }
      });
      if (!devices.length) {
        return;
      }

      const messaging = getMessaging(app);
      const dead: string[] = [];
      for (const language of ["vi", "en"] as const) {
        const tokens = devices
          .filter((device) => (device.language === "en" ? "en" : "vi") === language)
          .map((device) => device.token);
        if (!tokens.length) {
          continue;
        }
        const { title, body } = pushText(language, notification);
        const result = await messaging.sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: {
            notificationId: String(notification.id),
            type: notification.type,
            entityType: notification.entityType ?? "",
            entityId: notification.entityId ? String(notification.entityId) : ""
          },
          android: { priority: "high", notification: { channelId: "omnihr_default" } },
          apns: { payload: { aps: { sound: "default" } } }
        });
        result.responses.forEach((response, index) => {
          if (!response.success && DEAD_TOKEN_CODES.has(response.error?.code ?? "")) {
            dead.push(tokens[index]);
          }
        });
      }
      if (dead.length) {
        await this.prisma.pushDevice.deleteMany({ where: { token: { in: dead } } });
      }
    } catch (error) {
      this.logger.warn(`Push for notification ${notification.id} failed: ${String(error)}`);
    }
  }

  async onModuleDestroy() {
    if (this.app) {
      await deleteApp(this.app);
    }
  }

  /** The Firebase app, set up on first use; null when push is not configured. */
  private firebase(): App | null {
    if (this.app !== undefined) {
      return this.app;
    }
    const raw = this.config.get<string>("FIREBASE_SERVICE_ACCOUNT_JSON")?.trim();
    if (!raw) {
      this.app = null;
      return null;
    }
    try {
      // Raw JSON, or the same base64-encoded so it fits on one .env line.
      const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
      const account = JSON.parse(json) as ServiceAccount & { project_id?: string };
      this.app = initializeApp({ credential: cert(account) }, "omnihr-push");
      this.logger.log(`Push notifications on for Firebase project ${account.project_id ?? ""}`);
    } catch (error) {
      this.logger.error(`FIREBASE_SERVICE_ACCOUNT_JSON is not a usable service account: ${String(error)}`);
      this.app = null;
    }
    return this.app;
  }
}
