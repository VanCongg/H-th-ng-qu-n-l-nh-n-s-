// Gửi email qua SMTP (mặc định Gmail + app password). Không cấu hình SMTP:
// môi trường dev in nội dung email (mã OTP) ra log, production thì từ chối.

import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { ApiError } from "../common/api-error";

export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Sends email through SMTP (Gmail by default: SMTP_USER is the address,
 * SMTP_PASS an app password for it). With no SMTP credentials a development
 * API writes the message to its log instead - so a verification code can
 * still be read and used - and a production one refuses, rather than tell
 * someone a code is on its way when it never will be.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  get isConfigured() {
    return Boolean(this.config.get<string>("SMTP_USER") && this.config.get<string>("SMTP_PASS"));
  }

  async send(mail: OutgoingMail) {
    if (!this.isConfigured) {
      if (this.config.get<string>("NODE_ENV") === "production") {
        throw new ApiError(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Email is not configured on the server",
          "MAIL_NOT_CONFIGURED"
        );
      }
      this.logger.warn(`SMTP not configured - email to ${mail.to} not sent:\n${mail.subject}\n${mail.text}`);
      return;
    }
    try {
      await this.transport().sendMail({
        from: this.config.get<string>("MAIL_FROM") || `OmniHR <${this.config.get<string>("SMTP_USER")}>`,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html
      });
    } catch (error) {
      this.logger.error(`Email to ${mail.to} failed: ${error instanceof Error ? error.message : error}`);
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        "The email could not be sent; try again in a moment",
        "MAIL_SEND_FAILED"
      );
    }
  }

  private transport() {
    if (!this.transporter) {
      const port = Number(this.config.get<string>("SMTP_PORT") ?? 465);
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>("SMTP_HOST") || "smtp.gmail.com",
        port,
        secure: port === 465,
        auth: {
          user: this.config.get<string>("SMTP_USER"),
          pass: this.config.get<string>("SMTP_PASS")
        }
      });
    }
    return this.transporter;
  }
}
