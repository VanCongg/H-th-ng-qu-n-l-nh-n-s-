import type { Position } from "@prisma/client";

export type PositionRoleShape = Pick<Position, "code" | "name">;

export function isManagerPosition(position?: PositionRoleShape | null) {
  if (!position) {
    return false;
  }

  const value = `${position.code} ${position.name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /\b(manager|lead|leader|head|director|supervisor|truong|quan ly)\b/.test(
    value
  );
}
