import type { Position } from "@prisma/client";
export type PositionRoleShape = Pick<Position, "code" | "name">;
export declare function isManagerPosition(position?: PositionRoleShape | null): boolean;
