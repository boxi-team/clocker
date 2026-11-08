package com.lolstats.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Inbound limit per IP per minute (fixed window). */
@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_MS = 60_000;

    private static final class Window {
        long start;
        int count;
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final AppProps props;
    private final ObjectMapper om;

    public RateLimitFilter(AppProps props, ObjectMapper om) {
        this.props = props;
        this.om = om;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        long now = System.currentTimeMillis();
        Window w = windows.computeIfAbsent(req.getRemoteAddr(), k -> new Window());
        int count;
        long retryAfterSec;
        synchronized (w) {
            if (now - w.start >= WINDOW_MS) {
                w.start = now;
                w.count = 0;
            }
            count = ++w.count;
            retryAfterSec = Math.max(1, (WINDOW_MS - (now - w.start)) / 1000);
        }
        if (windows.size() > 10_000) windows.entrySet().removeIf(e -> now - e.getValue().start >= WINDOW_MS);

        if (count > props.inboundRateLimit()) {
            res.setStatus(429);
            res.setHeader("Retry-After", String.valueOf(retryAfterSec));
            res.setContentType("application/json");
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("code", "RATE_LIMITED");
            err.put("message", "Too many requests");
            om.writeValue(res.getOutputStream(), Map.of("error", err));
            return;
        }
        chain.doFilter(req, res);
    }
}
