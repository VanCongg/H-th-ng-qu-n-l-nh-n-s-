import { IsInt, IsOptional, Max, Min } from "class-validator";

export class FinalizeReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  finalRating?: number;
}
