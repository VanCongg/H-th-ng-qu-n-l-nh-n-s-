import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { ApiError } from "../common/api-error";

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * SMTP delivery. Email stays disabled until SMTP_HOST is set, so a missing
 * config fails loudly instead of silently dropping messages.
 */
@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>("SMTP_HOST")?.trim();
    const user = config.get<string>("SMTP_USER")?.trim();
    const secure = config.get<boolean | string>("SMTP_SECURE");

    this.from = config.get<string>("SMTP_FROM") || "OmniHR <no-reply@omnihr.local>";
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get("SMTP_PORT") ?? 587),
          secure: secure === true || secure === "true",
          auth: user
            ? { user, pass: config.get<string>("SMTP_PASS") ?? "" }
            : undefined
        })
      : null;
  }

  ensureConfigured() {
    if (!this.transporter) {
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        "Email delivery is not configured",
        "MAIL_NOT_CONFIGURED"
      );
    }
  }

  async send(message: MailMessage) {
    this.ensureConfigured();
    await this.transporter!.sendMail({ from: this.from, ...message });
  }
}
