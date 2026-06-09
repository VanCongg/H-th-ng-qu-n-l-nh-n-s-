"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReqContext = void 0;
const common_1 = require("@nestjs/common");
exports.ReqContext = (0, common_1.createParamDecorator)((_data, context) => {
    const request = context.switchToHttp().getRequest();
    return {
        ip: request.ip,
        userAgent: request.headers?.["user-agent"]
    };
});
//# sourceMappingURL=request-context.decorator.js.map