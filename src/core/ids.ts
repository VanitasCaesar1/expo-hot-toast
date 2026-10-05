let counter = 0;

/**
 * Collision-proof id generator.
 *
 * react-hot-toast uses a bare module-level counter ("1", "2", ...). That
 * collides when two copies of the library land in one bundle (a very common
 * Metro monorepo outcome) and resets unpredictably under Fast Refresh, which
 * means a pending toast can be silently adopted by an unrelated new one.
 *
 * Counter alone gives ordering, which we want for stable queue order.
 * Randomness alone gives uniqueness but no ordering.
 * We need both, so we combine them.
 */
export function genId(): string {
  counter += 1;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `t${time}-${counter.toString(36)}-${rand}`;
}

/** Test-only. Resets the counter so snapshots stay deterministic. */
export function __resetIdCounter(): void {
  counter = 0;
}