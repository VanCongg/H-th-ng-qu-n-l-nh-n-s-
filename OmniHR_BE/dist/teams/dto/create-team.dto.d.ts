export declare class CreateTeamDto {
    departmentId: number;
    leadId?: number;
    code: string;
    name: string;
    description?: string;
    isActive?: boolean;
    memberIds?: number[];
}
