import { UpdateUserEmployeeProfileDto } from "./user-employee-profile.dto";
export declare class UpdateUserDto {
    username?: string;
    email?: string;
    password?: string;
    isActive?: boolean;
    mustChangePassword?: boolean;
    roleIds?: number[];
    employeeProfile?: UpdateUserEmployeeProfileDto;
}
