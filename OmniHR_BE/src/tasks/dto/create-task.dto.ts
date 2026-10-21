import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { CareerLevel, TaskPriority, TaskStatus } from "@prisma/client";
import { TaskRequiredSkillDto } from "./task-required-skill.dto";

export class CreateTaskDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentTaskId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamId?: number;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  technologies?: string[];

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /** The least experienced level the work suits; null clears it on update. */
  @IsOptional()
  @IsEnum(CareerLevel)
  minLevel?: CareerLevel | null;

  /** The most experienced level it is worth; null clears it on update. */
  @IsOptional()
  @IsEnum(CareerLevel)
  maxLevel?: CareerLevel | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualHours?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskRequiredSkillDto)
  requiredSkills?: TaskRequiredSkillDto[];
}
