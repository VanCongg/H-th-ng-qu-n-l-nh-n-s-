import { IsDateString, IsOptional } from "class-validator";

export class EndManagerDto {
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
