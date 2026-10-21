// Mã OTP 6 số gửi qua email trước khi đổi mật khẩu / số điện thoại / email.
// - Chỉ lưu bản băm SHA-256 có trộn secret của server.
// - Mã hết hạn sau 10 phút, gửi lại sau 60 giây, sai 5 lần thì vô hiệu.
// - Mã gắn với giá trị mới cần duyệt; đổi email thì mã gửi tới địa chỉ MỚI để chứng minh quyền sở hữu.

import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { VerificationPurpose } from "@prisma/client";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "./mail.service";

/** A code works for this long after it is sent. */
export const CODE_TTL_MS = 10 * 60 * 1000;
/** A new code for the same purpose can be asked for after this long. */
export const RESEND_AFTER_MS = 60 * 1000;
/** Wrong tries a code allows before it stops working. */
export const MAX_CODE_ATTEMPTS = 5;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "ng***@gmail.com": enough to recognise one's own address, not to harvest it. */
// Che bớt email khi hiển thị: "ng***@gmail.com".
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) {
    return email;
  }
  return `${name.slice(0, Math.min(2, name.length))}***@${domain}`;
}

/** The phone as stored: trimmed, and empty meaning none. */
export function normalizePhone(phone: string | null | undefined) {
  return (phone ?? "").trim();
}

const PURPOSE_TEXT: Record<VerificationPurpose, string> = {
  PASSWORD_CHANGE: "đổi mật khẩu",
  PASSWORD_RESET: "đặt lại mật khẩu",
  PHONE_CHANGE: "đổi số điện thoại",
  EMAIL_CHANGE: "đổi email"
};

/**
 * One-time codes sent by email before a person changes their password, phone
 * or email. Only a hash of the code is stored. A code is tied to what it
 * approves - the new phone or email - so it cannot approve a different
 * value than the one it was sent for. For a new email the code goes to that
 * new address: receiving it is the proof the address belongs to them.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService
  ) {}

  /** `user` only needs its id: a forgotten-password request has no session. */
  async requestCode(
    user: Pick<AuthUser, "id">,
    purpose: VerificationPurpose,
    rawTarget: string | null | undefined,
    context?: RequestContext
  ) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, employee: { select: { fullName: true, phone: true } } }
    });
    if (!account) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }
    const target = await this.checkTarget(user, purpose, rawTarget, account);

    const last = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    });
    const waitMs = last ? RESEND_AFTER_MS - (Date.now() - last.createdAt.getTime()) : 0;
    if (waitMs > 0) {
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        `Wait ${Math.ceil(waitMs / 1000)} seconds before asking for a new code`,
        "VERIFICATION_RESEND_TOO_SOON"
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const sendTo = purpose === VerificationPurpose.EMAIL_CHANGE ? (target as string) : account.email;
    // An earlier, unused code for the same change stops working.
    await this.prisma.verificationCode.updateMany({
      where: { userId: user.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() }
    });
    const record = await this.prisma.verificationCode.create({
      data: {
        userId: user.id,
        purpose,
        target,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS)
      }
    });
    try {
      await this.mail.send(this.codeMail(sendTo, code, purpose, account.employee?.fullName ?? null));
    } catch (error) {
      await this.prisma.verificationCode.delete({ where: { id: record.id } });
      throw error;
    }

    await this.audit.log({
      userId: user.id,
      action: "SEND_VERIFICATION_CODE",
      entityType: "User",
      entityId: user.id,
      newValue: { purpose, sentTo: maskEmail(sendTo) },
      context
    });
    return {
      purpose,
      sentTo: maskEmail(sendTo),
      expiresAt: record.expiresAt,
      resendAfterSeconds: Math.round(RESEND_AFTER_MS / 1000)
    };
  }

  /**
   * Checks and uses up the code for `purpose`. `target` must be the value the
   * code was sent for. Throws with a code-specific error when it does not pass.
   */
  // Kiểm tra và dùng mã: đúng mục đích, đúng giá trị, còn hạn, chưa quá số lần sai.
  // So sánh bằng timingSafeEqual để không lộ thông tin qua thời gian so sánh.
  async consume(userId: number, purpose: VerificationPurpose, code: string | undefined, target: string | null = null) {
    if (!code) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "A verification code sent to your email is required",
        "VERIFICATION_CODE_REQUIRED"
      );
    }
    const record = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    });
    if (!record) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "The verification code has expired; ask for a new one",
        "VERIFICATION_CODE_EXPIRED"
      );
    }
    if (record.attempts >= MAX_CODE_ATTEMPTS) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Too many wrong codes; ask for a new one",
        "VERIFICATION_CODE_LOCKED"
      );
    }
    if ((record.target ?? null) !== (target ?? null)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "This code was sent for a different value; ask for a new one",
        "VERIFICATION_TARGET_MISMATCH"
      );
    }
    const matches = timingSafeEqual(Buffer.from(record.codeHash), Buffer.from(this.hash(code.trim())));
    if (!matches) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } }
      });
      throw new ApiError(HttpStatus.BAD_REQUEST, "The verification code is wrong", "VERIFICATION_CODE_INVALID");
    }
    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() }
    });
  }

  /** Tells the old address that the account's email has moved. */
  // Báo cho địa chỉ email cũ biết email tài khoản vừa được đổi.
  async notifyEmailChanged(oldEmail: string, newEmail: string, fullName: string | null) {
    const greeting = fullName ? `Xin chào ${fullName},` : "Xin chào,";
    const text = `${greeting}\n\nEmail tài khoản OmniHR của bạn vừa được đổi sang ${maskEmail(newEmail)}. Nếu không phải bạn thực hiện, hãy liên hệ quản trị viên ngay.`;
    await this.mail
      .send({
        to: oldEmail,
        subject: "OmniHR - Email tài khoản đã được thay đổi",
        text,
        html: this.layout(text.replace(/\n/g, "<br>"))
      })
      .catch(() => undefined);
  }

  private async checkTarget(
    user: Pick<AuthUser, "id">,
    purpose: VerificationPurpose,
    rawTarget: string | null | undefined,
    account: { email: string; employee: { phone: string | null } | null }
  ): Promise<string | null> {
    if (purpose === VerificationPurpose.PASSWORD_CHANGE || purpose === VerificationPurpose.PASSWORD_RESET) {
      return null;
    }
    if (purpose === VerificationPurpose.PHONE_CHANGE) {
      const phone = normalizePhone(rawTarget);
      if (phone === normalizePhone(account.employee?.phone)) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "That is already your phone number", "VERIFICATION_NOTHING_TO_CHANGE");
      }
      return phone;
    }
    const email = (rawTarget ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Enter a valid email address", "VALIDATION_ERROR");
    }
    if (email === account.email.toLowerCase()) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "That is already your email", "VERIFICATION_NOTHING_TO_CHANGE");
    }
    const taken = await this.prisma.user.findFirst({
      where: { id: { not: user.id }, OR: [{ email }, { username: email }] },
      select: { id: true }
    });
    const takenByEmployee = await this.prisma.employee.findFirst({
      where: { personalEmail: email, userId: { not: user.id } },
      select: { id: true }
    });
    if (taken || takenByEmployee) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "That email is already in use", "EMAIL_ALREADY_IN_USE");
    }
    return email;
  }

  private codeMail(to: string, code: string, purpose: VerificationPurpose, fullName: string | null) {
    const action = PURPOSE_TEXT[purpose];
    const greeting = fullName ? `Xin chào ${fullName},` : "Xin chào,";
    const minutes = Math.round(CODE_TTL_MS / 60000);
    const text = `${greeting}\n\nMã xác thực để ${action} trên OmniHR của bạn là: ${code}\nMã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này với bất kỳ ai.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này và đổi mật khẩu ngay.`;
    const html = this.layout(
      `<p>${greeting}</p><p>Mã xác thực để <b>${action}</b> trên OmniHR của bạn là:</p>` +
        `<p style="font-size:30px;font-weight:800;letter-spacing:8px;margin:18px 0;color:#1971c2">${code}</p>` +
        `<p>Mã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này với bất kỳ ai.</p>` +
        `<p style="color:#868e96">Nếu bạn không yêu cầu, hãy bỏ qua email này và đổi mật khẩu ngay.</p>`
    );
    return { to, subject: `OmniHR - Mã xác thực ${action}: ${code}`, text, html };
  }

  private layout(body: string) {
    return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e9ecef;border-radius:12px"><h2 style="margin-top:0;color:#1971c2">OmniHR</h2>${body}</div>`;
  }

  /** SHA-256 with a server secret mixed in: a leaked table does not give codes away. */
  private hash(code: string) {
    return createHash("sha256")
      .update(`${this.config.get<string>("JWT_ACCESS_SECRET") ?? ""}:${code}`)
      .digest("hex");
  }
}
