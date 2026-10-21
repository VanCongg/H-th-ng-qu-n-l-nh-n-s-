// Dữ liệu làm mới token: refresh token hiện có.

import { IsString, MinLength } from "class-validator";

export class RefreshTokenDto {
  @IsString()
  @MinLength(20)
  refreshToken: string;
}
