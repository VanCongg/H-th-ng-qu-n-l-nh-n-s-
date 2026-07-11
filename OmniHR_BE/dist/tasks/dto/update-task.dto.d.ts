import { CreateTaskDto } from "./create-task.dto";
declare const UpdateTaskDto_base: import("@nestjs/common").Type<Partial<Omit<CreateTaskDto, "teamId" | "parentTaskId" | "projectId">>>;
export declare class UpdateTaskDto extends UpdateTaskDto_base {
}
export {};
