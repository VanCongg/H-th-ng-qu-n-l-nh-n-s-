"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentUserWhere = currentUserWhere;
exports.currentEmployeeWhere = currentEmployeeWhere;
function andWhere(...filters) {
    const activeFilters = filters.filter(Boolean);
    if (activeFilters.length === 1) {
        return activeFilters[0];
    }
    return { AND: activeFilters };
}
function currentUserWhere(...filters) {
    return andWhere({ deletedAt: null }, ...filters);
}
function currentEmployeeWhere(...filters) {
    return andWhere({ deletedAt: null }, {
        OR: [
            { userId: null },
            {
                user: {
                    is: currentUserWhere()
                }
            }
        ]
    }, ...filters);
}
//# sourceMappingURL=prisma-where.js.map