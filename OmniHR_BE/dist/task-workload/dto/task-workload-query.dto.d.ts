export type TaskWorkloadScope = "all" | "team" | "self";
export declare class TaskWorkloadQueryDto {
    employeeId?: number;
    scope?: TaskWorkloadScope;
}
