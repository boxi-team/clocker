package com.lolstats.common;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AppExceptionTest {

    @Test
    void standardConstructorSetsFields() {
        AppException ex = new AppException(400, ErrorCode.INVALID_PARAMETER, "Bad input");
        assertEquals(400, ex.status());
        assertEquals(ErrorCode.INVALID_PARAMETER, ex.code());
        assertEquals("Bad input", ex.getMessage());
        assertNull(ex.details());
        assertNull(ex.retryAfter());
    }

    @Test
    void fullConstructorSetsAllFields() {
        Map<String, String> details = Map.of("field", "tier");
        AppException ex = new AppException(429, ErrorCode.RATE_LIMITED, "Too fast", details, 30);
        assertEquals(429, ex.status());
        assertEquals(ErrorCode.RATE_LIMITED, ex.code());
        assertEquals("Too fast", ex.getMessage());
        assertEquals(details, ex.details());
        assertEquals(30, ex.retryAfter());
    }

    @Test
    void notFoundFactory() {
        AppException ex = AppException.notFound(ErrorCode.CHAMPION_NOT_FOUND, "Ahri not found");
        assertEquals(404, ex.status());
        assertEquals(ErrorCode.CHAMPION_NOT_FOUND, ex.code());
        assertEquals("Ahri not found", ex.getMessage());
    }

    @Test
    void dataNotReadyFactory() {
        AppException ex = AppException.dataNotReady();
        assertEquals(503, ex.status());
        assertEquals(ErrorCode.DATA_NOT_READY, ex.code());
        assertTrue(ex.getMessage().contains("No data synced yet"));
    }

    @Test
    void invalidFactoryCreatesFormattedDetails() {
        AppException ex = AppException.invalid("region", "Required");
        assertEquals(400, ex.status());
        assertEquals(ErrorCode.INVALID_PARAMETER, ex.code());
        assertEquals("Invalid request parameters", ex.getMessage());
        assertNotNull(ex.details());
        assertTrue(ex.details() instanceof List<?>);

        @SuppressWarnings("unchecked")
        List<Map<String, String>> list = (List<Map<String, String>>) ex.details();
        assertEquals(1, list.size());
        assertEquals("region", list.get(0).get("path"));
        assertEquals("Required", list.get(0).get("message"));
    }

    @Test
    void invalidMessageFactory() {
        AppException ex = AppException.invalidMessage("Custom message");
        assertEquals(400, ex.status());
        assertEquals(ErrorCode.INVALID_PARAMETER, ex.code());
        assertEquals("Custom message", ex.getMessage());
    }
}
