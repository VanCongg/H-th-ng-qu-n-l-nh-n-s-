import { TeamMemberRole } from "@prisma/client";
export declare class UpdateTeamMemberDto {
    role?: TeamMemberRole;
    isActive?: boolean;
}
