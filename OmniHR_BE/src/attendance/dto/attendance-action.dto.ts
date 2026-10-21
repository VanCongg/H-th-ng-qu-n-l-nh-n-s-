// Dữ liệu check-in / check-out từ điện thoại: tọa độ, địa chỉ, độ sai số (mét),
// có phải vị trí giả (mock) không, và vị trí đã lấy cách đây bao lâu.

import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export class AttendanceActionDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  /** The phone's own estimate of how far off the fix may be, in metres. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracyMeters?: number;

  /** Android reports a fix that came from a mock-location app. */
  @IsOptional()
  @IsBoolean()
  isMocked?: boolean;

  /** How old the fix was when sent: a cached fix may be from somewhere else. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  positionAgeSeconds?: number;
}
