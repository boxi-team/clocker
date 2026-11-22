package com.lolstats.riot;

import static org.junit.jupiter.api.Assertions.*;

import com.lolstats.config.AppProps.Limit;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class RateLimiterTest {

    @Test
    void acquireUnderLimitDoesNotBlock() throws Exception {
        AtomicLong now = new AtomicLong(1000);
        RateLimiter limiter = new RateLimiter(List.of(new Limit(5, 1000)), now::get);

        for (int i = 0; i < 5; i++) {
            limiter.acquire();
        }
        assertEquals(1000, now.get());
    }

    @Test
    void blockForDelaysSubsequentAcquires() throws Exception {
        AtomicLong now = new AtomicLong(1000);
        RateLimiter limiter = new RateLimiter(List.of(new Limit(5, 1000)), now::get);

        limiter.blockFor(500); // blocked until 1500

        Thread t = new Thread(() -> {
            try {
                Thread.sleep(30);
            } catch (InterruptedException ignored) {}
            now.set(1600);
        });
        t.start();

        limiter.acquire();
        assertTrue(now.get() >= 1500);
        t.join();
    }

    @Test
    void slidingWindowPurgesOldStamps() throws Exception {
        AtomicLong now = new AtomicLong(1000);
        RateLimiter limiter = new RateLimiter(List.of(new Limit(2, 500)), now::get);

        limiter.acquire(); // at 1000
        limiter.acquire(); // at 1000

        // Advance past window (500ms)
        now.set(1600);
        limiter.acquire(); // should not block
        assertEquals(1600, now.get());
    }
}
