import { AuthUser, RequestContext } from "../common/types";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { UpdateSelfEmployeeDto } from "./dto/update-self-employee.dto";
import { EmployeesService } from "./employees.service";
export declare class EmployeesController {
    private readonly employeesService;
    constructor(employeesService: EmployeesService);
    findAll(query: EmployeeQueryDto): Promise<{
        items: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findTeam(user: AuthUser, query: EmployeeQueryDto): Promise<{
        items: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    me(user: AuthUser): Promise<any>;
    updateMe(user: AuthUser, dto: UpdateSelfEmployeeDto, context: RequestContext): Promise<any>;
    findOne(id: number, user: AuthUser): Promise<any>;
    create(dto: CreateEmployeeDto, user: AuthUser, context: RequestContext): Promise<{
        employeeId: number;
        userId: number;
        employeeCode: string;
        fullName: string;
        companyEmail: string;
        username: string;
        defaultPassword: string;
        mustChangePassword: boolean;
        employee: any;
    }>;
    update(id: number, dto: UpdateEmployeeDto, user: AuthUser, context: RequestContext): Promise<any>;
    remove(id: number, user: AuthUser, context: RequestContext): Promise<any>;
    resetPassword(id: number, user: AuthUser, context: RequestContext): Promise<{
        employeeId: number;
        userId: number;
        username: string;
        defaultPassword: string;
        mustChangePassword: boolean;
    }>;
    lockUser(id: number, user: AuthUser, context: RequestContext): Promise<Record<string, unknown>>;
    unlockUser(id: number, user: AuthUser, context: RequestContext): Promise<Record<string, unknown>>;
}
