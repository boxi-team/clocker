package com.lolstats.config;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.servlet.ServletException;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestTimingFilterTest {
    private final RequestTimingFilter filter = new RequestTimingFilter();

    @Test
    void optionsBypassesFilter() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest("OPTIONS", "/v1/champions");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(req, res, chain);
        assertNotNull(chain.getRequest()); // shouldNotFilter allows request to continue directly to chain
    }

    @Test
    void regularRequestProceedsThroughChain() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/v1/health");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(req, res, chain);
        assertNotNull(chain.getRequest());
        assertEquals(200, res.getStatus());
    }
}
