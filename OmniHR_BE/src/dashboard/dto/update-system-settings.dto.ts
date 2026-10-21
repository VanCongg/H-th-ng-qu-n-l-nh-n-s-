// Dữ liệu cập nhật cấu hình hệ thống.

import { IsObject } from "class-validator";

export class UpdateSystemSettingsDto {
  @IsObject()
  settings: Record<string, unknown>;
}
