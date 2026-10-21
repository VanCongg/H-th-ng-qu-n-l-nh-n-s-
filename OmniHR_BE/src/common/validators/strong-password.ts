import { Matches, ValidationOptions } from "class-validator";

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

const STRONG_PASSWORD_MESSAGE =
  "Password must include uppercase, lowercase, number, and special character";

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return Matches(STRONG_PASSWORD_REGEX, {
    message: STRONG_PASSWORD_MESSAGE,
    ...validationOptions,
  });
}
