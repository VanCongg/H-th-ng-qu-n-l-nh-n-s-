/**
 * Small rules of the simulated company, kept apart from simulate-day.ts so they
 * can be unit tested without booting the API the simulator acts through.
 */

/**
 * Where punches are generated when system settings carry no company location.
 * The simulator sets this point as the company location on its first run, the
 * way an admin would before anyone checks in.
 */
export const FALLBACK_OFFICE = { latitude: 21.0227, longitude: 105.8466 };

/**
 * The simulator fills in history; it must never invent a future. `--until` is
 * therefore clamped to today, so no dataset can end up containing attendance,
 * tasks or leave for a date that has not happened yet.
 */
export function clampToToday(until: Date, today: Date) {
  return until > today ? today : until;
}

/**
 * The company point an admin configured, or [FALLBACK_OFFICE] when none is set.
 * Punches are scattered within ~30m of it, which keeps a simulated day inside
 * whatever attendance radius the settings ask for.
 */
export function officeFrom(settingsValue: unknown) {
  const value = (settingsValue ?? {}) as Record<string, unknown>;
  const latitude = value.companyLatitude;
  const longitude = value.companyLongitude;
  if (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude)
  ) {
    return { latitude, longitude };
  }
  return FALLBACK_OFFICE;
}

/**
 * Every team-level task belongs to a project - the API refuses one without.
 * Operations, support and unplanned work belong to no product, so each
 * department gets one internal project per year to hold them, the way
 * companies book such work in practice.
 */
export function internalProjectCode(departmentCode: string, year: number) {
  return `${departmentCode}-OPS-${year}`;
}

export function isInternalProjectCode(code: string) {
  return /-OPS-\d{4}$/.test(code);
}
