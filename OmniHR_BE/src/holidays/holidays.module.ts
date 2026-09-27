import { Module } from "@nestjs/common";
import { HolidaysController } from "./holidays.controller";

/** The admin API; HolidaysService itself is global (PrismaModule). */
@Module({
  controllers: [HolidaysController]
})
export class HolidaysModule {}
