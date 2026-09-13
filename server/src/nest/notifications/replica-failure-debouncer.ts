/**
 * Lazy per-backend debounce (backfill/stats/notifications spec): the first
 * failure notifies immediately; later failures accumulate and the next one
 * past the window rides out as a summary carrying the suppressed count. No
 * timers — the summary is sent on the next failure, which is the only moment
 * anyone would care. Process-local, like the health ring itself.
 */
export class ReplicaFailureDebouncer {
  private readonly windows = new Map<string, { windowStart: number; suppressed: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** null = suppress; otherwise the suppressed-count to report with this send. */
  admit(backend: string): number | null {
    const now = this.now();
    const window = this.windows.get(backend);
    if (!window || now - window.windowStart > this.windowMs) {
      const suppressed = window?.suppressed ?? 0;
      this.windows.set(backend, { windowStart: now, suppressed: 0 });
      return suppressed;
    }
    window.suppressed += 1;
    return null;
  }
}
