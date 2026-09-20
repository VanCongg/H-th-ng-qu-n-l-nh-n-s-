import {
  DEFAULT_SCORE_WEIGHTS,
  ScoreWeights,
  combineScores,
  compareCandidates,
  fairShares,
  historyPrior,
  historySignal
} from "./suggestion-scoring";

/**
 * Scenario tests for the ranking as a whole, rather than for one formula.
 *
 * Every number the offline evaluation produces is an average over thousands of
 * replayed decisions, which is exactly the shape of measurement that can look
 * healthy while the feature does something indefensible in a specific case a
 * manager will notice. These assert the behaviour in those cases.
 */

type Signals = {
  name: string;
  skill: number;
  workload: number;
  availability: number;
  history: number | null;
  /** Away for most of the task window on approved leave. */
  leaveBlocked?: boolean;
};

function rank(candidates: Signals[], weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS) {
  return candidates
    .map((candidate) => ({
      candidate,
      score: combineScores([
        { value: candidate.skill, weight: weights.skill },
        { value: candidate.workload, weight: weights.workload },
        { value: candidate.availability, weight: weights.availability },
        { value: candidate.history, weight: weights.history }
      ])
    }))
    .sort((left, right) =>
      compareCandidates(
        {
          eligible: true,
          leaveBlocked: left.candidate.leaveBlocked,
          score: left.score,
          skillScore: left.candidate.skill
        },
        {
          eligible: true,
          leaveBlocked: right.candidate.leaveBlocked,
          score: right.score,
          skillScore: right.candidate.skill
        }
      )
    );
}

const NOW = new Date("2026-09-21T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function finishedLongAgo(count: number, onTime: boolean) {
  return Array.from({ length: count }, (_, index) => {
    const completedAt = new Date(NOW.getTime() - (90 + index) * DAY);
    const dueOffset = onTime ? 0 : -5;
    const due = new Date(completedAt.getTime() + dueOffset * DAY);
    return {
      completedAt,
      dueDate: new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())),
      estimatedHours: 8,
      actualHours: 8
    };
  });
}

describe("ranking scenarios", () => {
  it("does not put the strongest person first when they are on approved leave", () => {
    // The outcome label cannot see this: in the data a task given to someone on
    // leave often still lands on time, because a colleague picks it up.
    const ranked = rank([
      {
        name: "star on leave",
        skill: 95,
        workload: 90,
        availability: 20,
        history: 95,
        leaveBlocked: true
      },
      { name: "solid and free", skill: 80, workload: 85, availability: 100, history: 78 }
    ]);

    expect(ranked[0].candidate.name).toBe("solid and free");
  });

  it("still separates an all-newcomer team instead of scoring everyone alike", () => {
    // Every candidate gets the same peer prior, so the track record cancels out
    // and the other three signals have to do the work.
    const prior = historyPrior([null, null, null]);
    const ranked = rank([
      { name: "better skills", skill: 90, workload: 70, availability: 100, history: prior },
      { name: "weaker skills", skill: 45, workload: 70, availability: 100, history: prior },
      { name: "busy", skill: 90, workload: 20, availability: 100, history: prior }
    ]);

    expect(ranked[0].candidate.name).toBe("better skills");
    expect(ranked[0].score).toBeGreaterThan(ranked[2].score);
  });

  it("demotes the overloaded star once the fair-share penalty applies", () => {
    const ranked = rank([
      { name: "star", skill: 95, workload: 60, availability: 100, history: 92 },
      { name: "rested", skill: 82, workload: 95, availability: 100, history: 80 }
    ]);
    expect(ranked[0].candidate.name).toBe("star");

    // Four of the team's last six assignments went to the star.
    const penalty = fairShares(new Map([[1, 4], [2, 1], [3, 1]])).get(1)!.penalty;
    const adjusted = ranked[0].score - penalty;

    expect(adjusted).toBeLessThan(ranked[1].score);
  });

  it("does not collapse to a tie when the task declares no required skills", () => {
    // assessSkills hands every candidate the same 70 in that case, so the
    // ranking has to come from the other signals rather than from nothing.
    const ranked = rank([
      { name: "free and reliable", skill: 70, workload: 95, availability: 100, history: 88 },
      { name: "swamped", skill: 70, workload: 15, availability: 100, history: 88 }
    ]);

    expect(ranked[0].candidate.name).toBe("free and reliable");
    expect(ranked[0].score - ranked[1].score).toBeGreaterThan(5);
  });

  it("keeps a bad week from wrecking a long track record", () => {
    // The lag window is what protects this: last week's disaster is not in the
    // score yet, and by the time it is, it is one item among many.
    const longRecord = historySignal(finishedLongAgo(30, true), NOW, 50);
    const recentDisaster = historySignal(
      [
        ...finishedLongAgo(30, true),
        {
          completedAt: new Date(NOW.getTime() - 2 * DAY),
          dueDate: new Date(Date.UTC(2026, 8, 1)),
          estimatedHours: 8,
          actualHours: 40
        }
      ],
      NOW,
      50
    );

    expect(recentDisaster.score).toBe(longRecord.score);
  });

  it("moves a newcomer's score smoothly from the peer prior to their own record", () => {
    const prior = 40;
    const scores = [0, 1, 2, 4, 8, 16, 32].map(
      (count) => historySignal(finishedLongAgo(count, true), NOW, prior).score
    );

    expect(scores[0]).toBe(prior);
    // Monotone and gradual: no step where the score jumps by more than a third
    // of the whole range, which is what the old "null below three tasks" rule
    // did the moment someone finished their third task.
    for (let index = 1; index < scores.length; index += 1) {
      expect(scores[index]).toBeGreaterThan(scores[index - 1]);
      expect(scores[index] - scores[index - 1]).toBeLessThan((100 - prior) / 3);
    }
    expect(scores[scores.length - 1]).toBeGreaterThan(90);
  });

  it("ranks a proven performer above a newcomer, but not out of sight", () => {
    const prior = 60;
    const proven = historySignal(finishedLongAgo(25, true), NOW, prior).score;
    const newcomer = historySignal([], NOW, prior).score;

    expect(proven).toBeGreaterThan(newcomer);
    // The newcomer keeps a real chance: a candidate who is free and well
    // matched still outranks a busy veteran.
    const ranked = rank([
      { name: "busy veteran", skill: 75, workload: 25, availability: 100, history: 70 },
      { name: "free newcomer", skill: 90, workload: 100, availability: 100, history: newcomer }
    ]);
    expect(ranked[0].candidate.name).toBe("free newcomer");
  });
});
