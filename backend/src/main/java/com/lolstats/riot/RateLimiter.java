package com.lolstats.riot;

import com.lolstats.config.AppProps.Limit;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

/**
 * Sliding-window limiter. Every window must have room before a request starts.
 * Callers are served one at a time.
 */
public class RateLimiter {
    private final List<Limit> limits;
    private final LongSupplier clock;
    private final Deque<Long> stamps = new ArrayDeque<>();
    private final AtomicLong blockedUntil = new AtomicLong();

    public RateLimiter(List<Limit> limits) {
        this(limits, System::currentTimeMillis);
    }

    public RateLimiter(List<Limit> limits, LongSupplier clock) {
        this.limits = limits;
        this.clock = clock;
    }

    /** Called after a 429: nothing starts before {@code ms} has passed. */
    public void blockFor(long ms) {
        blockedUntil.accumulateAndGet(clock.getAsLong() + ms, Math::max);
    }

    /** Blocks until a request may start, then records it. */
    public synchronized void acquire() throws InterruptedException {
        long longest = limits.stream().mapToLong(Limit::windowMs).max().orElse(0);
        for (;;) {
            long now = clock.getAsLong();
            while (!stamps.isEmpty() && now - stamps.peekFirst() >= longest) stamps.pollFirst();
            long waitMs = Math.max(0, blockedUntil.get() - now);
            for (Limit l : limits) {
                List<Long> inWindow = stamps.stream().filter(t -> now - t < l.windowMs()).toList();
                if (inWindow.size() >= l.max()) {
                    long oldestBlocking = inWindow.get(inWindow.size() - l.max());
                    waitMs = Math.max(waitMs, l.windowMs() - (now - oldestBlocking));
                }
            }
            if (waitMs <= 0) {
                stamps.addLast(now);
                return;
            }
            Thread.sleep(waitMs + 5);
        }
    }
}
