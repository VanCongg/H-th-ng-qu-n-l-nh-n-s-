// Module mã xác thực một lần (OTP) gửi qua email.

import { Global, Module } from "@nestjs/common";
import { AuditService } from "../common/services/audit.service";
import { MailService } from "./mail.service";
import { VerificationService } from "./verification.service";

/** Email one-time codes, used by the password, phone and email changes. */
@Global()
@Module({
  providers: [MailService, VerificationService, AuditService],
  exports: [MailService, VerificationService]
})
export class VerificationModule {}
