"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isManagerPosition = isManagerPosition;
function isManagerPosition(position) {
    if (!position) {
        return false;
    }
    const value = `${position.code} ${position.name}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    return /\b(manager|lead|leader|head|director|supervisor|truong|quan ly)\b/.test(value);
}
//# sourceMappingURL=position-role.js.map