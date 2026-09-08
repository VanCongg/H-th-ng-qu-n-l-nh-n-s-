import { IsDateString, IsString, MaxLength } from "class-validator";

export class CreateReviewCycleDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
