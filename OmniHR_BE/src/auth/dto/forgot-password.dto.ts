import { IsString, MaxLength, MinLength } from "class-validator";

export class ForgotPasswordDto {
  /** Username, email or employee code - whatever signs the person in. */
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  identifier: string;
}
