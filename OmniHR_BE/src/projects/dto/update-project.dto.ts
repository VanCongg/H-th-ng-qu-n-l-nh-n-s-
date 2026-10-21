// Dữ liệu sửa dự án: các trường của CreateProjectDto, đều không bắt buộc.

import { PartialType } from "@nestjs/swagger";
import { CreateProjectDto } from "./create-project.dto";

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
