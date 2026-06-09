"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const roles = ["ADMIN", "MANAGER", "EMPLOYEE"];
const permissions = [
    "USER_CREATE",
    "USER_READ",
    "USER_UPDATE",
    "USER_DELETE",
    "ROLE_CREATE",
    "ROLE_READ",
    "ROLE_UPDATE",
    "ROLE_DELETE",
    "ROLE_ASSIGN",
    "PERMISSION_READ",
    "PERMISSION_ASSIGN",
    "POLICY_CREATE",
    "POLICY_READ",
    "POLICY_UPDATE",
    "POLICY_DELETE",
    "EMPLOYEE_CREATE",
    "EMPLOYEE_READ_ALL",
    "EMPLOYEE_READ_TEAM",
    "EMPLOYEE_READ_SELF",
    "EMPLOYEE_UPDATE_ALL",
    "EMPLOYEE_UPDATE_SELF",
    "EMPLOYEE_DELETE",
    "DEPARTMENT_CREATE",
    "DEPARTMENT_READ",
    "DEPARTMENT_UPDATE",
    "DEPARTMENT_DELETE",
    "POSITION_CREATE",
    "POSITION_READ",
    "POSITION_UPDATE",
    "POSITION_DELETE",
    "MANAGER_ASSIGN",
    "MANAGER_READ",
    "MANAGER_REMOVE",
    "ATTENDANCE_CHECK_IN",
    "ATTENDANCE_CHECK_OUT",
    "ATTENDANCE_READ_ALL",
    "ATTENDANCE_READ_TEAM",
    "ATTENDANCE_READ_SELF",
    "ATTENDANCE_ADJUST",
    "LEAVE_TYPE_CREATE",
    "LEAVE_TYPE_READ",
    "LEAVE_TYPE_UPDATE",
    "LEAVE_TYPE_DELETE",
    "LEAVE_CREATE",
    "LEAVE_READ_ALL",
    "LEAVE_READ_TEAM",
    "LEAVE_READ_SELF",
    "LEAVE_APPROVE",
    "LEAVE_REJECT",
    "LEAVE_CANCEL_SELF",
    "AUDIT_LOG_READ",
    "SYSTEM_SETTING_READ",
    "SYSTEM_SETTING_UPDATE"
];
const leaveTypes = [
    ["ANNUAL_LEAVE", "Annual leave", 12],
    ["SICK_LEAVE", "Sick leave", 30],
    ["UNPAID_LEAVE", "Unpaid leave", null],
    ["MATERNITY_LEAVE", "Maternity leave", 180],
    ["MARRIAGE_LEAVE", "Marriage leave", 3],
    ["BEREAVEMENT_LEAVE", "Bereavement leave", 3]
];
const rolePermissions = {
    ADMIN: permissions,
    MANAGER: [
        "EMPLOYEE_READ_TEAM",
        "EMPLOYEE_READ_SELF",
        "ATTENDANCE_READ_TEAM",
        "ATTENDANCE_READ_SELF",
        "LEAVE_READ_TEAM",
        "LEAVE_READ_SELF",
        "LEAVE_APPROVE",
        "LEAVE_REJECT",
        "LEAVE_CREATE",
        "LEAVE_CANCEL_SELF",
        "MANAGER_READ",
        "LEAVE_TYPE_READ",
        "EMPLOYEE_UPDATE_SELF"
    ],
    EMPLOYEE: [
        "EMPLOYEE_READ_SELF",
        "EMPLOYEE_UPDATE_SELF",
        "ATTENDANCE_CHECK_IN",
        "ATTENDANCE_CHECK_OUT",
        "ATTENDANCE_READ_SELF",
        "LEAVE_CREATE",
        "LEAVE_READ_SELF",
        "LEAVE_CANCEL_SELF",
        "LEAVE_TYPE_READ",
        "MANAGER_READ"
    ]
};
async function main() {
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    for (const name of roles) {
        await prisma.role.upsert({
            where: { name },
            create: {
                name,
                description: `${name} role`,
                isSystem: true
            },
            update: {
                description: `${name} role`,
                isSystem: true
            }
        });
    }
    for (const code of permissions) {
        await prisma.permission.upsert({
            where: { code },
            create: {
                code,
                description: code.replace(/_/g, " ").toLowerCase()
            },
            update: {}
        });
    }
    for (const roleName of roles) {
        const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
        for (const code of rolePermissions[roleName]) {
            const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: permission.id
                    }
                },
                create: {
                    roleId: role.id,
                    permissionId: permission.id
                },
                update: {}
            });
        }
    }
    for (const [code, name, annualAllowance] of leaveTypes) {
        await prisma.leaveType.upsert({
            where: { code },
            create: {
                code,
                name,
                annualAllowance,
                isActive: true
            },
            update: {
                name,
                annualAllowance,
                isActive: true
            }
        });
    }
    await prisma.policy.upsert({
        where: { name: "manager-team-scope" },
        create: {
            name: "manager-team-scope",
            description: "Managers can access employees linked through employee_managers.",
            resource: "employee",
            action: "read_team",
            effect: "ALLOW",
            condition: { relation: "employee_managers", activeOnly: true },
            isActive: true
        },
        update: {
            isActive: true
        }
    });
    const username = process.env.DEFAULT_ADMIN_USERNAME ?? "admin";
    const email = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@corehr.local";
    const password = process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin@123456";
    const adminPasswordHash = await bcrypt.hash(password, saltRounds);
    const adminUser = await prisma.user.upsert({
        where: { username },
        create: {
            username,
            email,
            passwordHash: adminPasswordHash,
            mustChangePassword: false,
            isActive: true
        },
        update: {
            email,
            passwordHash: adminPasswordHash,
            isActive: true,
            deletedAt: null
        }
    });
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
    await prisma.userRole.upsert({
        where: {
            userId_roleId: {
                userId: adminUser.id,
                roleId: adminRole.id
            }
        },
        create: {
            userId: adminUser.id,
            roleId: adminRole.id
        },
        update: {}
    });
    await prisma.auditLog.create({
        data: {
            userId: adminUser.id,
            action: "SEED_ADMIN",
            entityType: "User",
            entityId: String(adminUser.id),
            newValue: { username, email }
        }
    });
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map