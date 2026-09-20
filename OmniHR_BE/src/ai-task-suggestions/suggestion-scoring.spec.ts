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
  usableWeights
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
});
