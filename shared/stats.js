/**
 * Shared stats helpers (currently not required by renderer.js, but kept
 * here for maintainability if you later move computation off the UI layer).
 */

function minOrNull(nums) {
  const filtered = nums.filter((n) => Number.isFinite(n));
  if (filtered.length === 0) return null;
  return Math.min(...filtered);
}

function computeFastLap(rows) {
  const valid = rows.filter((r) => Number.isFinite(r.lap_ms));
  if (!valid.length) return null;
  return valid.reduce((a, b) => (b.lap_ms < a.lap_ms ? b : a));
}

function computeSumOfBest(rows) {
  const s1 = minOrNull(rows.map((r) => r.s1_ms));
  const s2 = minOrNull(rows.map((r) => r.s2_ms));
  const s3 = minOrNull(rows.map((r) => r.s3_ms));
  if (s1 == null || s2 == null || s3 == null) return null;
  return { lap_ms: s1 + s2 + s3, s1_ms: s1, s2_ms: s2, s3_ms: s3 };
}

function computeAverageLap(rows) {
  const valid = rows.filter((r) => Number.isFinite(r.lap_ms)).map((r) => r.lap_ms);
  if (!valid.length) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round(sum / valid.length);
}

module.exports = {
  computeFastLap,
  computeSumOfBest,
  computeAverageLap
};
