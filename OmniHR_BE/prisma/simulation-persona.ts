import { CareerLevel } from "@prisma/client";

/**
 * The simulator's hidden per-employee traits. Shared with
 * prisma/evaluate-suggestions.ts, which uses `ability` as the ground truth the
 * AI assignee ranking is compared against.
 */

export type Persona = {
  /** 0..1 — drives speed, review pass rate and focus. */
  ability: number;
  lateRate: number;
  earlyOutRate: number;
  absenceRate: number;
  sickRate: number;
  /** Estimated hours delivered per hour worked. */
  speed: number;
  passRate: number;
};

/** Stable per employee: the same person is always the same kind of worker. */
export function buildPersona(code: string, level: CareerLevel, pastRating: number | null): Persona {
  const talent = hash01(`talent:${code}`);
  const levelBonus: Record<CareerLevel, number> = {
    INTERN: -0.1,
    FRESHER: -0.06,
    JUNIOR: -0.02,
    MIDDLE: 0,
    SENIOR: 0.06,
    LEAD: 0.08
  };
  const base = pastRating === null ? talent : 0.35 * ((pastRating - 1) / 4) + 0.65 * talent;
  const ability = clamp(0.03 + base * 0.97 + levelBonus[level], 0.05, 0.97);
  const discipline = clamp(0.5 * ability + 0.5 * hash01(`discipline:${code}`), 0, 1);
  return {
    ability,
    lateRate: 0.015 + 0.3 * (1 - discipline) ** 2,
    earlyOutRate: 0.01 + 0.08 * (1 - discipline) ** 2,
    absenceRate: 0.002 + 0.02 * (1 - discipline) ** 2,
    sickRate: 0.003 + 0.004 * hash01(`health:${code}`),
    speed: 0.6 + ability * 0.7,
    passRate: 0.5 + ability * 0.45
  };
}

/** Deterministic PRNG (mulberry32) so a replayed day or persona is identical. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function hash01(value: string) {
  return createRandom(hashString(value))();
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
