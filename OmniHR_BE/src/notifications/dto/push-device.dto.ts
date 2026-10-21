import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class RegisterPushDeviceDto {
  @IsString()
  @MaxLength(512)
  token: string;

  @IsIn(["android", "ios"])
  platform: string;

  /** Push text is written in this language; defaults to Vietnamese. */
  @IsOptional()
  @IsIn(["vi", "en"])
  language?: "vi" | "en";
}

export class RemovePushDeviceDto {
  @IsString()
  @MaxLength(512)
  token: string;
}
