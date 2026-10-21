import { BadRequestException, HttpStatus } from "@nestjs/common";
import { ArgumentsHost } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { HttpExceptionFilter } from "./http-exception.filter";
import { ApiError } from "../api-error";

describe("HttpExceptionFilter", () => {
  function createHost() {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    return {
      host: {
        switchToHttp: () => ({ getResponse: () => response })
      } as unknown as ArgumentsHost,
      response
    };
  }

  function prismaError(code: string, meta?: Record<string, unknown>) {
    return new Prisma.PrismaClientKnownRequestError("failed", {
      code,
      clientVersion: "5.0.0",
      meta
    });
  }

  it("names the conflicting field of a unique violation", () => {
    const { host, response } = createHost();

    new HttpExceptionFilter().catch(prismaError("P2002", { target: ["email"] }), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: "Duplicate value for field(s): email",
      errorCode: "VALIDATION_ERROR"
    });
  });

  it("strips the index name when Prisma reports the constraint instead", () => {
    const { host, response } = createHost();

    new HttpExceptionFilter().catch(
      prismaError("P2002", { target: "users_email_key" }),
      host
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Duplicate value for field(s): email" })
    );
  });

  it("falls back to a generic message when no target is reported", () => {
    const { host, response } = createHost();

    new HttpExceptionFilter().catch(prismaError("P2002"), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Unique constraint violated" })
    );
  });

  it("keeps the message and error code of an ApiError", () => {
    const { host, response } = createHost();

    new HttpExceptionFilter().catch(
      new ApiError(HttpStatus.BAD_REQUEST, "Email already exists", "VALIDATION_ERROR"),
      host
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: "Email already exists",
      errorCode: "VALIDATION_ERROR"
    });
  });

  it("joins the validation messages of a bad request", () => {
    const { host, response } = createHost();

    new HttpExceptionFilter().catch(
      new BadRequestException({
        message: ["email must be an email", "password should not be empty"],
        errorCode: "VALIDATION_ERROR"
      }),
      host
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "email must be an email; password should not be empty"
      })
    );
  });

  it("hides unexpected failures behind a 500", () => {
    const { host, response } = createHost();

    new HttpExceptionFilter().catch(new Error("boom"), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error",
      errorCode: "INTERNAL_SERVER_ERROR"
    });
  });
});
