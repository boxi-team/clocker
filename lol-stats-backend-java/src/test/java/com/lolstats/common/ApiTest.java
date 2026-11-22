package com.lolstats.common;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;

class ApiTest {

    @Test
    void objPreservesOrderAndHandlesNulls() {
        Map<String, Object> map = Api.obj("a", 1, "b", null, "c", "text");
        assertEquals(3, map.size());
        assertEquals(1, map.get("a"));
        assertNull(map.get("b"));
        assertEquals("text", map.get("c"));

        String[] keys = map.keySet().toArray(new String[0]);
        assertArrayEquals(new String[]{"a", "b", "c"}, keys);
    }

    @Test
    void okWrapsDataWithGeneratedAt() {
        Map<String, Object> res = Api.ok("test-data");
        assertEquals("test-data", res.get("data"));
        assertNotNull(res.get("meta"));

        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) res.get("meta");
        assertTrue(meta.containsKey("generatedAt"));
        assertNotNull(meta.get("generatedAt"));
    }

    @Test
    void okWithMetaMergesMetadata() {
        Map<String, Object> extraMeta = Map.of("total", 100, "region", "euw1");
        Map<String, Object> res = Api.ok("payload", extraMeta);

        assertEquals("payload", res.get("data"));
        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) res.get("meta");
        assertEquals(100, meta.get("total"));
        assertEquals("euw1", meta.get("region"));
        assertTrue(meta.containsKey("generatedAt"));
    }

    @Test
    void cachedSetsCorrectCacheControlHeader() {
        ResponseEntity<Object> response = Api.cached(60, "cached-body");
        assertEquals(200, response.getStatusCode().value());
        assertEquals("cached-body", response.getBody());
        String cacheControl = response.getHeaders().getCacheControl();
        assertNotNull(cacheControl);
        assertTrue(cacheControl.contains("max-age=60"));
        assertTrue(cacheControl.contains("public"));
    }

    @Test
    void roundRoundsCorrectly() {
        assertEquals(12.35, Api.round(12.3456, 2));
        assertEquals(12.3, Api.round(12.34, 1));
        assertEquals(12.0, Api.round(12.34, 0));
        assertEquals(0.1235, Api.round(0.123456, 4));
        assertEquals(-5.67, Api.round(-5.666, 2));
    }

    @Test
    void ratioCalculatesAndRoundsRatio() {
        assertEquals(0.5, Api.ratio(1, 2));
        assertEquals(0.3333, Api.ratio(1, 3));
        assertEquals(0.0, Api.ratio(5, 0));
        assertEquals(0.0, Api.ratio(0, 10));
        assertEquals(0.0, Api.ratio(5, -1));
    }
}
