"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const response = host.switchToHttp().getResponse();
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const body = exception.getResponse();
            if (typeof body === "object" && body !== null) {
                const payload = body;
                response.status(status).json({
                    success: false,
                    message: this.normalizeMessage(payload.message),
                    errorCode: payload.errorCode ?? this.errorCodeForStatus(status)
                });
                return;
            }
            response.status(status).json({
                success: false,
                message: String(body),
                errorCode: this.errorCodeForStatus(status)
            });
            return;
        }
        if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            response.status(common_1.HttpStatus.BAD_REQUEST).json({
                success: false,
                message: this.prismaMessage(exception),
                errorCode: "VALIDATION_ERROR"
            });
            return;
        }
        response.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error",
            errorCode: "INTERNAL_SERVER_ERROR"
        });
    }
    normalizeMessage(message) {
        if (Array.isArray(message)) {
            return message.join("; ");
        }
        if (typeof message === "string") {
            return message;
        }
        return "Request failed";
    }
    errorCodeForStatus(status) {
        if (status === common_1.HttpStatus.UNAUTHORIZED) {
            return "UNAUTHORIZED";
        }
        if (status === common_1.HttpStatus.FORBIDDEN) {
            return "FORBIDDEN";
        }
        if (status === common_1.HttpStatus.BAD_REQUEST) {
            return "VALIDATION_ERROR";
        }
        return "REQUEST_ERROR";
    }
    prismaMessage(error) {
        if (error.code === "P2002") {
            return "Unique constraint violated";
        }
        if (error.code === "P2025") {
            return "Record not found";
        }
        return "Database request failed";
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map