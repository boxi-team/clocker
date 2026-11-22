package com.lolstats.config;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {
    private final ObjectMapper om = new ObjectMapper();
    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        // Limit set to 2 requests per minute (arg 13 is lowSampleGames=100, arg 14 is inboundRateLimit=2)
        AppProps props = new AppProps("", "", "", "", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 2,
                false, "euw1", 1000, "", false, "euw1", 100);
        filter = new RateLimitFilter(props, om);
    }

    @Test
    void optionsBypassesFilter() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest("OPTIONS", "/v1/champions");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(req, res, chain);
        assertNotNull(chain.getRequest()); // options is bypassed via shouldNotFilter and forwarded
    }

    @Test
    void requestsWithinLimitPassThrough() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/v1/champions");
        req.setRemoteAddr("192.168.1.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(req, res, chain);
        assertNotNull(chain.getRequest());
        assertEquals(200, res.getStatus());
    }

    @Test
    void exceedingRateLimitReturns429() throws ServletException, IOException {
        String ip = "10.0.0.1";

        // 1st request - ok
        MockHttpServletRequest req1 = new MockHttpServletRequest("GET", "/v1/test");
        req1.setRemoteAddr(ip);
        MockHttpServletResponse res1 = new MockHttpServletResponse();
        filter.doFilter(req1, res1, new MockFilterChain());
        assertEquals(200, res1.getStatus());

        // 2nd request - ok (limit is 2)
        MockHttpServletRequest req2 = new MockHttpServletRequest("GET", "/v1/test");
        req2.setRemoteAddr(ip);
        MockHttpServletResponse res2 = new MockHttpServletResponse();
        filter.doFilter(req2, res2, new MockFilterChain());
        assertEquals(200, res2.getStatus());

        // 3rd request - blocked with 429
        MockHttpServletRequest req3 = new MockHttpServletRequest("GET", "/v1/test");
        req3.setRemoteAddr(ip);
        MockHttpServletResponse res3 = new MockHttpServletResponse();
        filter.doFilter(req3, res3, new MockFilterChain());
        assertEquals(429, res3.getStatus());
        assertNotNull(res3.getHeader("Retry-After"));
        assertTrue(res3.getContentAsString().contains("RATE_LIMITED"));
    }
}
