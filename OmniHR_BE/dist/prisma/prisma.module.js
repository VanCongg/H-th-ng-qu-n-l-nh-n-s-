"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
const audit_service_1 = require("../common/services/audit.service");
const access_control_service_1 = require("../common/services/access-control.service");
const system_settings_service_1 = require("../common/services/system-settings.service");
let PrismaModule = class PrismaModule {
};
exports.PrismaModule = PrismaModule;
exports.PrismaModule = PrismaModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            prisma_service_1.PrismaService,
            audit_service_1.AuditService,
            access_control_service_1.AccessControlService,
            system_settings_service_1.SystemSettingsService
        ],
        exports: [
            prisma_service_1.PrismaService,
            audit_service_1.AuditService,
            access_control_service_1.AccessControlService,
            system_settings_service_1.SystemSettingsService
        ]
    })
], PrismaModule);
//# sourceMappingURL=prisma.module.js.map