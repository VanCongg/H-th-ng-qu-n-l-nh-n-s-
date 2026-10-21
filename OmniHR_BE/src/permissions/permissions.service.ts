// Đọc danh sách permission (permission được tạo sẵn bằng seed, không tạo qua API).

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.permission.findMany({
      orderBy: { code: "asc" }
    });
  }
}
