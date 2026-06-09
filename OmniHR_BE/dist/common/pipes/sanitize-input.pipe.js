"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitizeInputPipe = void 0;
const common_1 = require("@nestjs/common");
let SanitizeInputPipe = class SanitizeInputPipe {
    transform(value, _metadata) {
        return this.clean(value);
    }
    clean(value) {
        if (typeof value === "string") {
            return value
                .trim()
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                .replace(/javascript:/gi, "");
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.clean(item));
        }
        if (value && typeof value === "object") {
            return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
                key,
                this.clean(entry)
            ]));
        }
        return value;
    }
};
exports.SanitizeInputPipe = SanitizeInputPipe;
exports.SanitizeInputPipe = SanitizeInputPipe = __decorate([
    (0, common_1.Injectable)()
], SanitizeInputPipe);
//# sourceMappingURL=sanitize-input.pipe.js.map