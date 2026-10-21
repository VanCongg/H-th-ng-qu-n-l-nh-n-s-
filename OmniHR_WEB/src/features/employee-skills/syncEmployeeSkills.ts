import { employeeSkillsApi } from "../../api/endpoints";
import type { SkillProficiency } from "../../api/types";

// The employee form picks skills by name only, but the backend requires a level
// on every employee skill, so a skill added from there starts at the lowest one
// and is refined on the Employee Skills screen.
export const DEFAULT_SKILL_PROFICIENCY: SkillProficiency = "BEGINNER";

/**
 * Brings an employee's skills in line with the ids selected in the form: adds
 * the missing ones, drops the unselected ones, leaves the rest (and their
 * proficiency) untouched.
 */
export async function syncEmployeeSkills(
  employeeId: number,
  desiredSkillIds: number[]
) {
  const desiredIds = Array.from(new Set(desiredSkillIds));
  const desiredSet = new Set(desiredIds);
  const existingSkills = await employeeSkillsApi.list(employeeId);
  const existingIds = new Set(existingSkills.map((item) => item.skillId));

  await Promise.all([
    ...desiredIds
      .filter((skillId) => !existingIds.has(skillId))
      .map((skillId) =>
        employeeSkillsApi.create(employeeId, {
          skillId,
          proficiency: DEFAULT_SKILL_PROFICIENCY
        })
      ),
    ...existingSkills
      .filter((item) => !desiredSet.has(item.skillId))
      .map((item) => employeeSkillsApi.remove(item.id))
  ]);
}
