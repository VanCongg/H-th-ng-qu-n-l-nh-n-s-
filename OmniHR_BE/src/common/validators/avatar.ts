import { ValidateBy, ValidationOptions } from "class-validator";

export const MAX_AVATAR_VALUE_LENGTH = 950000;

const allowedAvatarDataUrl =
  /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
const allowedRemoteAvatarUrl = /^https?:\/\/[^\s]+$/i;

export function IsSafeAvatar(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: "isSafeAvatar",
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string") {
            return false;
          }
          if (value.length > MAX_AVATAR_VALUE_LENGTH) {
            return false;
          }
          return allowedAvatarDataUrl.test(value) || allowedRemoteAvatarUrl.test(value);
        },
        defaultMessage() {
          return "Avatar must be an http(s) URL or a png/jpeg/webp/gif data URL";
        },
      },
    },
    validationOptions
  );
}
