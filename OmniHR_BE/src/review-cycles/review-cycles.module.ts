import { Module } from "@nestjs/common";
import { ReviewCyclesController } from "./review-cycles.controller";
import { ReviewCyclesService } from "./review-cycles.service";

@Module({
  controllers: [ReviewCyclesController],
  providers: [ReviewCyclesService]
})
export class ReviewCyclesModule {}
