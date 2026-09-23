import { ValidationPipe } from "@nestjs/common";
import { CreateUserDto } from "../users/dto/create-user.dto";
import {
  flattenValidationMessages,
  validationExceptionFactory
} from "./validation-message";

describe("validation messages", () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationExceptionFactory
  });

  async function messageFor(payload: unknown) {
    try {
      await pipe.transform(payload, { type: "body", metatype: CreateUserDto });
    } catch (error) {
      const response = (error as { getResponse: () => { message: string } }).getResponse();
      return response.message;
    }

    throw new Error("expected the payload to be rejected");
  }

  it("reports every failing property of the payload", async () => {
    const message = await messageFor({ username: 1, email: "not-an-email" });

    expect(message).toContain("username must be a string");
    expect(message).toContain("email must be an email");
    expect(message.split("; ").length).toBeGreaterThan(1);
  });

  it("names the property of a rejected unknown field", async () => {
    const message = await messageFor({
      username: "vancong",
      email: "a@omnihr.vn",
      password: "Password@123",
      roleIds: [2],
      nickname: "cong"
    });

    expect(message).toContain("property nickname should not exist");
  });

  it("keeps the messages of a nested profile, prefixed with its path", async () => {
    const message = await messageFor({
      username: "vancong",
      email: "a@omnihr.vn",
      password: "Password@123",
      roleIds: [2],
      employeeProfile: { employeeCode: 1, fullName: "A", birthDate: "nope" }
    });

    expect(message).toContain("employeeProfile.employeeCode must be a string");
    expect(message).toContain(
      "employeeProfile.birthDate must be a valid ISO 8601 date string"
    );
  });

  it("attributes an array item message to the array itself", () => {
    const messages = flattenValidationMessages([
      {
        property: "roleIds",
        children: [
          {
            property: "0",
            constraints: { isInt: "0 must be an integer number" },
            children: []
          }
        ]
      }
    ]);

    expect(messages).toEqual(["roleIds must be an integer number"]);
  });

  it("falls back to a message when class-validator reports no constraint", () => {
    const exception = validationExceptionFactory([
      { property: "employeeProfile", children: [] }
    ]);

    expect(exception.getResponse()).toMatchObject({
      message: "Invalid request payload",
      errorCode: "VALIDATION_ERROR"
    });
  });
});
