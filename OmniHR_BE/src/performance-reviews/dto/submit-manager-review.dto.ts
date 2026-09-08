import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class SubmitManagerReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  managerRating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  managerComment?: string;
}
