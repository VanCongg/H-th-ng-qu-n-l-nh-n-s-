import {
  COLD_START_TASKS,
  DEFAULT_HISTORY_TUNING,
  DEFAULT_SCORE_WEIGHTS,
  NEUTRAL_HISTORY,
  FAIR_SHARE_PENALTY,
  combineScores,
  fairShares,
  historyPrior,
  historySignal,
  rawHistoryScore,
  usableHistory,
  usableWeights,
  DEFAULT_TASK_HOURS,
  leaveOverlapDays,
  levelFit,
  scoreCandidate,
  skillScoreWithLevel,
  taskDifficulty,
  weeklyLoad
} from "./suggestion-scoring";

const NOW = new Date("2026-09-21T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

/** `daysAgo` is when it was finished; the due date defaults to that same day. */
function finished(daysAgo: number, overrides: { lateDays?: number; estimated?: number; actual?: number } = {}) {
  const completedAt = new Date(NOW.getTime() - daysAgo * DAY);
  const due = new Date(completedAt.getTime() - (overrides.lateDays ?? 0) * DAY);
  return {
    completedAt,
    dueDate: new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())),
    estimatedHours: overrides.estimated ?? 8,
    actualHours: overrides.actual ?? 8
  };
}

describe("rawHistoryScore", () => {
  it("is null for someone who has finished nothing", () => {
    expect(rawHistoryScore([], 0.6)).toBeNull();
  });

  it("scores a punctual, on-estimate record at the top", () => {
    expect(rawHistoryScore([finished(90), finished(80), finished(70)], 0.6)).toBe(100);
  });

  it("counts a task finished on its due date as on time", () => {
    // Completion carries a clock time, the due date does not; comparing them
    // raw would make every same-day delivery look late.
    expect(rawHistoryScore([finished(90), finished(80), finished(70)], 0.6)).toBe(100);
  });

  it("drops with late deliveries, weighted by onTimeShare", () => {
    const tasks = [finished(90, { lateDays: 5 }), finished(80, { lateDays: 3 }), finished(70)];

    // One of three on time: 0.6 * (1/3) + 0.4 * 1 = 0.6
    expect(rawHistoryScore(tasks, 0.6)).toBeCloseTo(60, 5);
    // The same record judged mostly on hours instead: 0.2 * (1/3) + 0.8 * 1
    expect(rawHistoryScore(tasks, 0.2)).toBeCloseTo(86.667, 2);
  });

  it("penalises running over the estimate but does not reward beating it", () => {
    const over = [finished(90, { estimated: 5, actual: 10 })];
    const under = [finished(90, { estimated: 20, actual: 2 })];

    expect(rawHistoryScore(over, 0.6)).toBeCloseTo(80, 5);
    expect(rawHistoryScore(under, 0.6)).toBe(100);
  });
});

describe("usableHistory", () => {
  it("ignores tasks finished more recently than the lag", () => {
    const tasks = [finished(90), finished(10), finished(2)];

    expect(usableHistory(tasks, NOW, 45)).toHaveLength(1);
    expect(usableHistory(tasks, NOW, 0)).toHaveLength(3);
  });
});

describe("historySignal", () => {
  const prior = 40;

  it("gives a brand-new hire the peer prior, not a zero and not a null", () => {
    const signal = historySignal([], NOW, prior);

    expect(signal.score).toBe(prior);
    expect(signal.sampleSize).toBe(0);
    expect(signal.confidence).toBe(0);
  });

  it("shrinks a short record towards the prior", () => {
    const signal = historySignal([finished(90)], NOW, prior, {
      ...DEFAULT_HISTORY_TUNING,
      priorStrength: 4
    });

    // One task at 100 against a prior of 40: (1*100 + 4*40) / 5 = 52
    expect(signal.score).toBeCloseTo(52, 5);
    expect(signal.confidence).toBeCloseTo(0.2, 5);
  });

  it("hands over to the person's own record as it accumulates", () => {
    const many = Array.from({ length: 40 }, (_, index) => finished(60 + index));

    const signal = historySignal(many, NOW, prior);

    expect(signal.score).toBeGreaterThan(90);
    expect(signal.confidence).toBeGreaterThan(0.9);
  });

  it("treats a record that is all too recent as no record at all", () => {
    // Everything finished inside the lag window: the signal must fall back to
    // the prior rather than quietly scoring the person on nothing.
    const signal = historySignal([finished(3), finished(1)], NOW, prior);

    expect(signal.score).toBe(prior);
    expect(signal.sampleSize).toBe(0);
  });
});

describe("historyPrior", () => {
  it("takes the median of the peers who have a record", () => {
    expect(historyPrior([80, null, 40, null, 60])).toBe(60);
  });

  it("falls back to the wider shortlist, then to neutral", () => {
    expect(historyPrior([null, null], [70, 90])).toBe(80);
    expect(historyPrior([null], [])).toBe(NEUTRAL_HISTORY);
  });
});

describe("weights", () => {
  it("scores a candidate on the signals they do have", () => {
    const score = combineScores([
      { value: 80, weight: 0.5 },
      { value: 60, weight: 0.3 },
      { value: null, weight: 0.2 }
    ]);

    // 80 * 0.5 + 60 * 0.3, renormalised over the 0.8 of weight that applies.
    expect(score).toBeCloseTo(72.5, 5);
  });

  it("falls back to the defaults when every weight is zero", () => {
    expect(
      usableWeights({ skill: 0, workload: 0, availability: 0, history: 0 })
    ).toEqual(DEFAULT_SCORE_WEIGHTS);
  });

  it("keeps a cold-start threshold for reporting", () => {
    expect(COLD_START_TASKS).toBeGreaterThan(0);
  });
});

describe("fairShares", () => {
  it("leaves everyone alone when the work is spread evenly", () => {
    const shares = fairShares(new Map([[1, 2], [2, 2], [3, 2]]));

    expect(shares.get(1)?.penalty).toBe(0);
    expect(shares.get(1)?.share).toBe(1);
  });

  it("only penalises people above the team average", () => {
    // Team average is 2: one person on 4 is carrying double.
    const shares = fairShares(new Map([[1, 4], [2, 1], [3, 1]]));

    expect(shares.get(1)?.share).toBeCloseTo(2, 5);
    expect(shares.get(1)?.penalty).toBeCloseTo(FAIR_SHARE_PENALTY, 5);
    expect(shares.get(2)?.penalty).toBe(0);
    expect(shares.get(3)?.penalty).toBe(0);
  });

  it("does nothing when nobody has been assigned anything yet", () => {
    const shares = fairShares(new Map([[1, 0], [2, 0]]));

    expect(shares.get(1)?.penalty).toBe(0);
    expect(shares.get(2)?.penalty).toBe(0);
  });

  it("cannot promote someone the ranking rated lower", () => {
    // The penalty is one-sided by construction: below-average people get 0,
    // so rebalancing can only push candidates down, never lift them.
    const shares = fairShares(new Map([[1, 10], [2, 0]]));

    expect(shares.get(2)?.penalty).toBe(0);
    expect(shares.get(1)!.penalty).toBeGreaterThan(0);
  });

  it("keeps growing past twice the share instead of capping", () => {
    // Average 2, so person 1 carries 3x the team share.
    const shares = fairShares(new Map([[1, 6], [2, 0], [3, 0]]));

    expect(shares.get(1)?.share).toBeCloseTo(3, 5);
    expect(shares.get(1)?.penalty).toBeCloseTo(2 * FAIR_SHARE_PENALTY, 5);
  });
});

describe("weeklyLoad", () => {
  // Friday 25 September 2026.
  const today = new Date(Date.UTC(2026, 8, 25));
  const day = (d: number, m = 9) => new Date(Date.UTC(2026, m - 1, d));

  it("spreads a long task over the weeks until it is due", () => {
    // 80 hours due in about eight weeks: ten hours a week, not eighty.
    const load = weeklyLoad(
      [{ status: "IN_PROGRESS", estimatedHours: 80, dueDate: day(19, 11) }],
      today
    );

    expect(load.remainingHours).toBe(80);
    expect(load.weeklyHours).toBe(10);
  });

  it("counts only the hours still left", () => {
    const load = weeklyLoad(
      [{ status: "IN_PROGRESS", estimatedHours: 16, actualHours: 12, dueDate: day(26) }],
      today
    );

    expect(load.weeklyHours).toBe(4);
  });

  it("keeps an hour for an open task that has used up its estimate", () => {
    const load = weeklyLoad(
      [{ status: "IN_PROGRESS", estimatedHours: 8, actualHours: 10, dueDate: day(28) }],
      today
    );

    expect(load.weeklyHours).toBe(1);
  });

  it("adds nothing for work handed in for review", () => {
    const load = weeklyLoad(
      [{ status: "IN_REVIEW", estimatedHours: 20, dueDate: day(20) }],
      today
    );

    expect(load).toEqual({ remainingHours: 0, weeklyHours: 0, overdueCount: 0 });
  });

  it("puts overdue and undated work in this week and counts the overdue", () => {
    const load = weeklyLoad(
      [
        { status: "TODO", estimatedHours: 6, dueDate: day(20) },
        { status: "TODO", estimatedHours: null }
      ],
      today
    );

    expect(load.weeklyHours).toBe(6 + DEFAULT_TASK_HOURS);
    expect(load.overdueCount).toBe(1);
  });

  it("adds nothing yet for a task that starts after the coming week", () => {
    const load = weeklyLoad(
      [{ status: "TODO", estimatedHours: 30, startDate: day(15, 10), dueDate: day(30, 10) }],
      today
    );

    expect(load.remainingHours).toBe(30);
    expect(load.weeklyHours).toBe(0);
  });
});

describe("leaveOverlapDays", () => {
  it("counts a half day as half", () => {
    expect(
      leaveOverlapDays([{ keys: ["2026-10-09"], approved: true, halfDay: "MORNING" }])
    ).toEqual({ approvedDays: 0.5, pendingOnlyDays: 0 });
  });

  it("adds two halves of one date up to the whole day, never more", () => {
    const result = leaveOverlapDays([
      { keys: ["2026-10-09"], approved: true, halfDay: "MORNING" },
      { keys: ["2026-10-09"], approved: true, halfDay: "AFTERNOON" },
      { keys: ["2026-10-09"], approved: true }
    ]);

    expect(result.approvedDays).toBe(1);
  });

  it("adds from pending leave only what approved leave does not already cover", () => {
    const result = leaveOverlapDays([
      { keys: ["2026-10-09", "2026-10-12"], approved: true, halfDay: null },
      { keys: ["2026-10-12", "2026-10-13"], approved: false, halfDay: null },
      { keys: ["2026-10-14"], approved: false, halfDay: "AFTERNOON" }
    ]);

    expect(result).toEqual({ approvedDays: 2, pendingOnlyDays: 1.5 });
  });
});

describe("levelFit", () => {
  it("changes nothing without a range or without a level", () => {
    expect(levelFit("SENIOR", null, null)).toEqual({ fit: "ANY", gap: 0, penalty: 0 });
    expect(levelFit(null, "JUNIOR", "MIDDLE").penalty).toBe(0);
  });

  it("keeps the skill score of someone inside the range", () => {
    const fit = levelFit("JUNIOR", "FRESHER", "MIDDLE");
    expect(fit).toEqual({ fit: "FIT", gap: 0, penalty: 0 });
    expect(skillScoreWithLevel(80, fit)).toBe(80);
  });

  it("costs an overqualified senior a little on simple work", () => {
    // A fresher-to-junior task: a senior is two levels above it.
    const fit = levelFit("SENIOR", "FRESHER", "JUNIOR");
    expect(fit).toMatchObject({ fit: "OVER", gap: 2, penalty: 16 });
    expect(skillScoreWithLevel(100, fit)).toBe(84);
  });

  it("costs someone below the range more than someone above it", () => {
    const under = levelFit("FRESHER", "MIDDLE", null);
    const over = levelFit("SENIOR", null, "JUNIOR");
    expect(under).toMatchObject({ fit: "UNDER", gap: 2, penalty: 30 });
    expect(under.penalty).toBeGreaterThan(over.penalty);
  });

  it("caps the penalty and never goes below zero", () => {
    expect(levelFit("INTERN", "LEAD", null).penalty).toBe(45);
    expect(levelFit("LEAD", null, "INTERN").penalty).toBe(24);
    expect(skillScoreWithLevel(10, levelFit("INTERN", "LEAD", null))).toBe(0);
  });
});

describe("taskDifficulty", () => {
  const skill = (requiredProficiency: string, importance = "REQUIRED") =>
    ({ requiredProficiency, importance }) as never;

  it("reads the hardest required skill", () => {
    expect(taskDifficulty([skill("BEGINNER")])).toBe("EASY");
    expect(taskDifficulty([skill("BEGINNER"), skill("INTERMEDIATE")])).toBe("MEDIUM");
    expect(taskDifficulty([skill("INTERMEDIATE"), skill("EXPERT")])).toBe("HARD");
  });

  it("does not let a nice-to-have skill make the work hard", () => {
    expect(taskDifficulty([skill("BEGINNER"), skill("EXPERT", "NICE_TO_HAVE")])).toBe("EASY");
  });

  it("counts the lowest level the task suits", () => {
    expect(taskDifficulty([skill("BEGINNER")], "MIDDLE")).toBe("MEDIUM");
    expect(taskDifficulty([], "SENIOR")).toBe("HARD");
    expect(taskDifficulty([])).toBe("EASY");
  });
});

describe("scoreCandidate", () => {
  const weights = {
    skill: 0.1,
    workload: 0.15,
    availability: 0.1,
    history: 0.65,
    skillMultipliers: { EASY: 1, MEDIUM: 2, HARD: 4 }
  };
  // Strong in the skill, weak track record.
  const specialist = { skillScore: 100, workloadScore: 50, availabilityScore: 100, historyScore: 40 };

  it("lets the skill match count more on harder work", () => {
    const easy = scoreCandidate(weights, { ...specialist, difficulty: "EASY" });
    const hard = scoreCandidate(weights, { ...specialist, difficulty: "HARD" });

    expect(hard).toBeGreaterThan(easy);
    // Easy work: 0.1 of 100 + 0.15 of 50 + 0.1 of 100 + 0.65 of 40, over 1.0.
    expect(easy).toBeCloseTo(53.5, 5);
    // Hard work: the skill weight is 0.4, the total 1.3.
    expect(hard).toBeCloseTo((40 + 7.5 + 10 + 26) / 1.3, 5);
  });

  it("scores like the flat weights without a difficulty", () => {
    expect(scoreCandidate(weights, specialist)).toBeCloseTo(53.5, 5);
  });

  it("leaves leave out when it is not part of the run", () => {
    expect(
      scoreCandidate(weights, { ...specialist, availabilityScore: undefined, difficulty: "EASY" })
    ).toBeCloseTo((10 + 7.5 + 26) / 0.9, 5);
  });
});
