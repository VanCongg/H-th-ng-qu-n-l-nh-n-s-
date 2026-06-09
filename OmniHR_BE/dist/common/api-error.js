"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
const common_1 = require("@nestjs/common");
class ApiError extends common_1.HttpException {
    errorCode;
    constructor(statusCode, message, errorCode) {
        super({ success: false, message, errorCode }, statusCode);
        this.errorCode = errorCode;
    }
}
exports.ApiError = ApiError;
//# sourceMappingURL=api-error.js.map