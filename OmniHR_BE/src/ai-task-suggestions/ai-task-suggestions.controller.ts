// API gợi ý người làm task bằng AI (chấm điểm đa tiêu chí).

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { AiTaskSuggestionsService } from "./ai-task-suggestions.service";
import { AiTaskSuggestionQueryDto } from "./dto/ai-task-suggestion-query.dto";
import { CancelAiTaskSuggestionDto } from "./dto/cancel-ai-task-suggestion.dto";
import { GenerateAiTaskSuggestionDto } from "./dto/generate-ai-task-suggestion.dto";
import { SelectAiTaskSuggestionDto } from "./dto/select-ai-task-suggestion.dto";

@ApiTags("ai-task-suggestions")
@ApiBearerAuth()
@Controller()
export class AiTaskSuggestionsController {
  constructor(private readonly suggestionsService: AiTaskSuggestionsService) {}

  // Tạo gợi ý mới cho một task: chấm điểm và xếp hạng các ứng viên.
  @Permissions("AI_TASK_SUGGEST")
  @Post("tasks/:taskId/ai-suggestions")
  generate(
    @Param("taskId", ParseIntPipe) taskId: number,
    @Body() dto: GenerateAiTaskSuggestionDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.suggestionsService.generate(taskId, dto, user, context);
  }

  // Các lần gợi ý của một task.
  @Permissions("AI_TASK_SUGGEST", "AI_TASK_SELECT", "TASK_ASSIGNMENT_READ")
  @Get("tasks/:taskId/ai-suggestions")
  findByTask(
    @Param("taskId", ParseIntPipe) taskId: number,
    @CurrentUser() user: AuthUser
  ) {
    return this.suggestionsService.findByTask(taskId, user);
  }

  // Danh sách gợi ý trong phạm vi người dùng được xem.
  @Permissions("AI_TASK_SUGGEST", "AI_TASK_SELECT", "TASK_ASSIGNMENT_READ")
  @Get("ai-task-suggestions")
  findAll(@Query() query: AiTaskSuggestionQueryDto, @CurrentUser() user: AuthUser) {
    return this.suggestionsService.findAll(query, user);
  }

  // Chi tiết một lần gợi ý, kèm điểm từng ứng viên.
  @Permissions("AI_TASK_SUGGEST", "AI_TASK_SELECT", "TASK_ASSIGNMENT_READ")
  @Get("ai-task-suggestions/:id")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.suggestionsService.findOne(id, user);
  }

  // Chọn một ứng viên trong gợi ý -> giao task cho người đó.
  @Permissions("AI_TASK_SELECT")
  @Post("ai-task-suggestions/:id/select")
  select(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SelectAiTaskSuggestionDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.suggestionsService.select(id, dto, user, context);
  }

  // Hủy gợi ý (không chọn ai).
  @Permissions("AI_TASK_SELECT")
  @Post("ai-task-suggestions/:id/cancel")
  cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CancelAiTaskSuggestionDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.suggestionsService.cancel(id, dto, user, context);
  }
}
