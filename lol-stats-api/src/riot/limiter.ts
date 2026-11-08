const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Limit {
  max: number;
  windowMs: number;
}

/**
 * Sliding-window limiter. Every window must have room before a request starts.
 * Callers are served in order, one at a time.
 */
export class RateLimiter {
  private stamps: number[] = [];
  private chain: Promise<void> = Promise.resolve();
  private blockedUntil = 0;

  constructor(private limits: Limit[]) {}

  acquire(): Promise<void> {
    const turn = this.chain.then(() => this.waitForSlot());
    this.chain = turn.catch(() => undefined);
    return turn;
  }

  /** Called after a 429: nothing starts before `ms` has passed. */
  blockFor(ms: number) {
    this.blockedUntil = Math.max(this.blockedUntil, Date.now() + ms);
  }

  private async waitForSlot() {
    const longest = Math.max(...this.limits.map((l) => l.windowMs));
    for (;;) {
      const now = Date.now();
      this.stamps = this.stamps.filter((t) => now - t < longest);
      let waitMs = Math.max(0, this.blockedUntil - now);
      for (const l of this.limits) {
        const inWindow = this.stamps.filter((t) => now - t < l.windowMs);
        if (inWindow.length >= l.max) {
          const oldestBlocking = inWindow[inWindow.length - l.max];
          waitMs = Math.max(waitMs, l.windowMs - (now - oldestBlocking));
        }
      }
      if (waitMs <= 0) {
        this.stamps.push(now);
        return;
      }
      await sleep(waitMs + 5);
    }
  }
}
