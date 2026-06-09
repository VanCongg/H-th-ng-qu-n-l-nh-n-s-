import { AuthUser, RequestContext } from "../common/types";
import { CreatePolicyDto } from "./dto/create-policy.dto";
import { UpdatePolicyDto } from "./dto/update-policy.dto";
import { PoliciesService } from "./policies.service";
export declare class PoliciesController {
    private readonly policiesService;
    constructor(policiesService: PoliciesService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        resource: string;
        action: string;
        effect: string;
        condition: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        resource: string;
        action: string;
        effect: string;
        condition: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    create(dto: CreatePolicyDto, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        resource: string;
        action: string;
        effect: string;
        condition: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    update(id: number, dto: UpdatePolicyDto, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        resource: string;
        action: string;
        effect: string;
        condition: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    remove(id: number, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        resource: string;
        action: string;
        effect: string;
        condition: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
}
