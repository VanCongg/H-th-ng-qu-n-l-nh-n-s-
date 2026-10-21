/**
 * Logistic regression, written out rather than pulled in, so the whole
 * evaluation pipeline stays inside the backend's own toolchain (tsx + jest)
 * and CI needs no Python.
 *
 * Two fitting modes, because the suggestion feature has two kinds of labels:
 *
 *   - `fitPointwise`  — one row per example: P(label = 1 | x). Used to learn
 *     "will this assignment finish on time".
 *   - `fitPairwise`   — one row per (chosen, not chosen) pair: P(chosen ranks
 *     above the other). This is the RankNet reduction: a logistic model on the
 *     *difference* of two feature vectors, which needs no outcome label at all
 *     and learns the preference a lead actually expressed.
 *
 * Both use batch gradient descent with L2 regularisation on standardised
 * features, which is enough for a few thousand rows and a handful of columns,
 * and keeps the fit deterministic - the same data always gives the same model.
 */

export type Dataset = {
  features: number[][];
  labels: number[];
};

export type FitOptions = {
  /** Steps of batch gradient descent. */
  iterations?: number;
  learningRate?: number;
  /** L2 strength; the intercept is never penalised. */
  l2?: number;
};

export type LogisticModel = {
  weights: number[];
  intercept: number;
  /** Column means and deviations, so `score` can standardise new rows. */
  means: number[];
  deviations: number[];
  iterations: number;
  /** Mean log loss on the training rows, to spot a fit that went nowhere. */
  trainingLoss: number;
};

const DEFAULTS = { iterations: 400, learningRate: 0.5, l2: 0.01 };

/** Standard logistic curve, guarded against overflow at the tails. */
export function sigmoid(value: number) {
  if (value >= 0) {
    return 1 / (1 + Math.exp(-value));
  }
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function standardisation(features: number[][]) {
  const columns = features[0]?.length ?? 0;
  const means = new Array<number>(columns).fill(0);
  const deviations = new Array<number>(columns).fill(1);

  for (let column = 0; column < columns; column += 1) {
    let sum = 0;
    for (const row of features) {
      sum += row[column];
    }
    const mean = sum / features.length;
    let variance = 0;
    for (const row of features) {
      variance += (row[column] - mean) ** 2;
    }
    means[column] = mean;
    // A constant column carries no information; leaving its deviation at 1
    // turns it into a column of zeros instead of dividing by zero.
    const deviation = Math.sqrt(variance / features.length);
    deviations[column] = deviation > 1e-9 ? deviation : 1;
  }

  return { means, deviations };
}

function standardise(row: number[], means: number[], deviations: number[]) {
  return row.map((value, index) => (value - means[index]) / deviations[index]);
}

function descend(
  rows: number[][],
  labels: number[],
  options: FitOptions,
  withIntercept: boolean
) {
  const iterations = options.iterations ?? DEFAULTS.iterations;
  const learningRate = options.learningRate ?? DEFAULTS.learningRate;
  const l2 = options.l2 ?? DEFAULTS.l2;
  const columns = rows[0].length;
  const weights = new Array<number>(columns).fill(0);
  let intercept = 0;
  let loss = 0;

  for (let step = 0; step < iterations; step += 1) {
    const gradient = new Array<number>(columns).fill(0);
    let interceptGradient = 0;
    loss = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      let z = intercept;
      for (let column = 0; column < columns; column += 1) {
        z += weights[column] * row[column];
      }
      const predicted = sigmoid(z);
      const error = predicted - labels[index];
      for (let column = 0; column < columns; column += 1) {
        gradient[column] += error * row[column];
      }
      interceptGradient += error;
      const clamped = Math.min(Math.max(predicted, 1e-12), 1 - 1e-12);
      loss -= labels[index] * Math.log(clamped) + (1 - labels[index]) * Math.log(1 - clamped);
    }

    for (let column = 0; column < columns; column += 1) {
      weights[column] -=
        learningRate * (gradient[column] / rows.length + l2 * weights[column]);
    }
    if (withIntercept) {
      intercept -= learningRate * (interceptGradient / rows.length);
    }
    loss /= rows.length;
  }

  return { weights, intercept, trainingLoss: loss, iterations };
}

/** One row per example, label 0/1. */
export function fitPointwise(data: Dataset, options: FitOptions = {}): LogisticModel {
  if (!data.features.length) {
    throw new Error("fitPointwise needs at least one row");
  }
  const { means, deviations } = standardisation(data.features);
  const rows = data.features.map((row) => standardise(row, means, deviations));
  const fitted = descend(rows, data.labels, options, true);
  return { ...fitted, means, deviations };
}

/**
 * One row per ordered pair. The rows are already differences of two candidates'
 * feature vectors, so there is no intercept to fit: a constant preference for
 * "the first one" would be meaningless, and both orderings are fed in.
 */
export function fitPairwise(data: Dataset, options: FitOptions = {}): LogisticModel {
  if (!data.features.length) {
    throw new Error("fitPairwise needs at least one pair");
  }
  const { means, deviations } = standardisation(data.features);
  // Differences are already centred around zero; re-centring them would move
  // the decision boundary off the origin, so only the scale is reused.
  const rows = data.features.map((row) =>
    row.map((value, index) => value / deviations[index])
  );
  const fitted = descend(rows, data.labels, options, false);
  return {
    ...fitted,
    means: means.map(() => 0),
    deviations
  };
}

/** Probability for a raw (unstandardised) feature row. */
export function score(model: LogisticModel, features: number[]) {
  const row = standardise(features, model.means, model.deviations);
  let z = model.intercept;
  for (let column = 0; column < row.length; column += 1) {
    z += model.weights[column] * row[column];
  }
  return sigmoid(z);
}

/**
 * Weight per feature on the standardised scale, which is what can be compared
 * between features - the raw coefficients are in whatever unit the column uses.
 */
export function importances(model: LogisticModel, names: string[]) {
  return names
    .map((name, index) => ({ name, weight: model.weights[index] ?? 0 }))
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));
}
