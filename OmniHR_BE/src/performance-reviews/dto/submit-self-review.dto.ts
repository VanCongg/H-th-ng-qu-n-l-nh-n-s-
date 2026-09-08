import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class SubmitSelfReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  selfRating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  selfComment?: string;
}
