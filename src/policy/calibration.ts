export interface CalibrationRow { topScore: number | null; hasEvidence: boolean; }
export interface PolicyThreshold { threshold: number; balancedAccuracy: number; candidates: number[]; }

const nextUp = (value: number): number => value === 0 ? Number.MIN_VALUE : value + Math.abs(value) * Number.EPSILON;
const nextDown = (value: number): number => value === 0 ? -Number.MIN_VALUE : value - Math.abs(value) * Number.EPSILON;

export function choosePolicyThreshold(rows: readonly CalibrationRow[]): PolicyThreshold {
  if (!rows.some((row) => row.hasEvidence) || !rows.some((row) => !row.hasEvidence)) throw new Error('Calibration requires both evidence-present and evidence-absent classes.');
  if (rows.some((row) => row.topScore !== null && !Number.isFinite(row.topScore))) throw new Error('Calibration scores must be finite or null.');
  const scores = [...new Set(rows.flatMap((row) => row.topScore === null ? [] : [row.topScore]))].sort((a, b) => a - b);
  const candidates = scores.length === 0 ? [0] : [nextDown(scores[0]!), ...scores, nextUp(scores.at(-1)!)];
  const accuracy = (threshold: number, expected: boolean) => {
    const subset = rows.filter((row) => row.hasEvidence === expected);
    return subset.filter((row) => (row.topScore !== null && row.topScore >= threshold) === expected).length / subset.length;
  };
  const ranked = candidates.map((threshold) => ({ threshold, balancedAccuracy: (accuracy(threshold, true) + accuracy(threshold, false)) / 2 }))
    .sort((left, right) => right.balancedAccuracy - left.balancedAccuracy || right.threshold - left.threshold);
  return { ...ranked[0]!, candidates };
}
