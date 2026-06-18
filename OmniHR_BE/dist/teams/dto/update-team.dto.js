"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTeamDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_team_dto_1 = require("./create-team.dto");
class UpdateTeamDto extends (0, swagger_1.PartialType)(create_team_dto_1.CreateTeamDto) {
}
exports.UpdateTeamDto = UpdateTeamDto;
//# sourceMappingURL=update-team.dto.js.map