import { BadRequestException } from "@nestjs/common";
import { ValidationError } from "class-validator";

// class-validator keeps the messages of a nested DTO on `children`, so reading
// `constraints` alone loses them and the client receives an empty message.
export function flattenValidationMessages(
  errors: ValidationError[],
  parentPath = ""
): string[] {
  return errors.flatMap((error) => {
    // Array items are reported as "0", "1", ...; keep the property they belong to.
    const path = /^\d+$/.test(error.property)
      ? parentPath || error.property
      : parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

    const own = Object.values(error.constraints ?? {}).map((message) =>
      qualifyProperty(message, error.property, path)
    );

    return [...own, ...flattenValidationMessages(error.children ?? [], path)];
  });
}

export function validationExceptionFactory(errors: ValidationError[]) {
  const messages = flattenValidationMessages(errors);

  return new BadRequestException({
    success: false,
    message: messages.length ? messages.join("; ") : "Invalid request payload",
    errorCode: "VALIDATION_ERROR"
  });
}

// Default messages start with the bare property name; the client needs the full
// path to tell `employeeProfile.fullName` from `fullName`.
function qualifyProperty(message: string, property: string, path: string) {
  if (property === path) {
    return message;
  }

  if (message.startsWith(`${property} `)) {
    return `${path}${message.slice(property.length)}`;
  }

  if (message.startsWith(`property ${property} `)) {
    return `property ${path}${message.slice(`property ${property}`.length)}`;
  }

  return message;
}
