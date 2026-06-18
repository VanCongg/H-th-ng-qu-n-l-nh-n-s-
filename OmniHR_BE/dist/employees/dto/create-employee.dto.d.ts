import { CareerLevel, EmployeeStatus } from "@prisma/client";
export declare class CreateEmployeeDto {
    employeeCode: string;
    fullName: string;
    companyEmail: string;
    avatarUrl?: string | null;
    personalEmail?: string;
    phone?: string;
    birthDate: string;
    hireDate?: string;
    status?: EmployeeStatus;
    departmentId?: number;
    positionId?: number;
    careerLevel?: CareerLevel;
}
