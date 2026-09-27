import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { ProjectStatus } from "@prisma/client";

export class CreateProjectDto {
  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  /** `null` on update clears the date. */
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}
