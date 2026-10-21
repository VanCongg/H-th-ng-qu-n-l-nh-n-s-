import {
  fitPairwise,
  fitPointwise,
  importances,
  score,
  sigmoid
} from "./logistic-regression";

describe("logistic regression", () => {
  it("keeps the sigmoid stable at both tails", () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 10);
    expect(sigmoid(800)).toBe(1);
    // The naive form overflows to NaN here; this one has to return a number.
    expect(sigmoid(-800)).toBe(0);
  });

  it("learns a separable pointwise rule", () => {
    const features: number[][] = [];
    const labels: number[] = [];
    for (let value = 0; value < 40; value += 1) {
      features.push([value]);
      labels.push(value >= 20 ? 1 : 0);
    }

    const model = fitPointwise({ features, labels }, { iterations: 1500 });

    expect(score(model, [38])).toBeGreaterThan(0.8);
    expect(score(model, [2])).toBeLessThan(0.2);
    expect(model.trainingLoss).toBeLessThan(0.3);
  });

  it("ignores a column that never varies instead of dividing by zero", () => {
    const features = [
      [1, 7],
      [2, 7],
      [8, 7],
      [9, 7]
    ];
    const labels = [0, 0, 1, 1];

    const model = fitPointwise({ features, labels });

    expect(Number.isFinite(score(model, [9, 7]))).toBe(true);
    expect(model.weights[1]).toBeCloseTo(0, 6);
  });

  it("learns from pairs which feature a chooser prefers", () => {
    // Pairs are differences: positive first column means the first candidate
    // had the higher skill score, and that one was always the one chosen.
    const features: number[][] = [];
    const labels: number[] = [];
    for (let gap = 1; gap <= 20; gap += 1) {
      features.push([gap, 0]);
      labels.push(1);
      features.push([-gap, 0]);
      labels.push(0);
    }

    const model = fitPairwise({ features, labels }, { iterations: 800 });

    expect(model.weights[0]).toBeGreaterThan(0);
    expect(model.intercept).toBe(0);
    expect(score(model, [5, 0])).toBeGreaterThan(0.5);
    expect(score(model, [-5, 0])).toBeLessThan(0.5);
  });

  it("ranks feature importance on the standardised scale", () => {
    const features = [
      [0, 100],
      [1, 100],
      [0, 900],
      [1, 900]
    ];
    const labels = [0, 0, 1, 1];

    const model = fitPointwise({ features, labels }, { iterations: 900 });
    const ranked = importances(model, ["noise", "signal"]);

    // Raw coefficients would make the 100-900 column look tiny next to the
    // 0-1 one; standardising is what makes them comparable.
    expect(ranked[0].name).toBe("signal");
  });
});
