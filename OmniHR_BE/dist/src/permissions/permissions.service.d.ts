import { PrismaService } from "../prisma/prisma.service";
export declare class PermissionsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        description: string | null;
    }[]>;
}
