import { CreateUserEmployeeProfileDto } from "./user-employee-profile.dto";
export declare class CreateUserDto {
    username: string;
    email: string;
    password: string;
    isActive?: boolean;
    mustChangePassword?: boolean;
    roleIds?: number[];
    employeeProfile?: CreateUserEmployeeProfileDto;
}
