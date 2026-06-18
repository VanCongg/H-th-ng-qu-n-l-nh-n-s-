import { TeamMemberRole } from "@prisma/client";
export declare class AddTeamMemberDto {
    employeeId: number;
    role?: TeamMemberRole;
}
