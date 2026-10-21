import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === "object" && body !== null) {
        const payload = body as Record<string, unknown>;
        response.status(status).json({
          success: false,
          message: this.normalizeMessage(payload.message),
          errorCode: (payload.errorCode as string) ?? this.errorCodeForStatus(status)
        });
        return;
      }

      response.status(status).json({
        success: false,
        message: String(body),
        errorCode: this.errorCodeForStatus(status)
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: this.prismaMessage(exception),
        errorCode: "VALIDATION_ERROR"
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      errorCode: "INTERNAL_SERVER_ERROR"
    });
  }

  private normalizeMessage(message: unknown): string {
    if (Array.isArray(message)) {
      return message.join("; ");
    }

    if (typeof message === "string") {
      return message;
    }

    return "Request failed";
  }

  private errorCodeForStatus(status: number): string {
    if (status === HttpStatus.UNAUTHORIZED) {
      return "UNAUTHORIZED";
    }

    if (status === HttpStatus.FORBIDDEN) {
      return "FORBIDDEN";
    }

    if (status === HttpStatus.BAD_REQUEST) {
      return "VALIDATION_ERROR";
    }

    return "REQUEST_ERROR";
  }

  private prismaMessage(error: Prisma.PrismaClientKnownRequestError): string {
    if (error.code === "P2002") {
      const fields = this.uniqueTargetFields(error.meta?.target);
      return fields.length
        ? `Duplicate value for field(s): ${fields.join(", ")}`
        : "Unique constraint violated";
    }

    if (error.code === "P2025") {
      return "Record not found";
    }

    return "Database request failed";
  }

  // Prisma reports the conflicting columns as `["email"]`, or as the raw index
  // name (`"users_email_key"`) when it cannot resolve them to fields.
  private uniqueTargetFields(target: unknown): string[] {
    const raw = Array.isArray(target)
      ? target.filter((item): item is string => typeof item === "string")
      : typeof target === "string"
        ? [target]
        : [];

    return raw.map((item) =>
      item.replace(/^.*?_(.+)_key$/, "$1").split("_").join(" ")
    );
  }
}
