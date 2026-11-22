package com.lolstats.common;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class QTest {

    @Test
    void strValidation() {
        Q qNull = new Q(null);
        assertEquals("defaultVal", qNull.str("name", 10, "defaultVal"));

        Q q = new Q(Map.of("name", "Ahri", "empty", "", "longName", "SuperLongChampionName"));
        assertEquals("Ahri", q.str("name", 10, "def"));
        assertEquals("def", q.str("empty", 10, "def"));
        assertEquals("def", q.str("missing", 10, "def"));

        AppException ex = assertThrows(AppException.class, () -> q.str("longName", 5, "def"));
        assertEquals(400, ex.status());
        assertEquals(ErrorCode.INVALID_PARAMETER, ex.code());
    }

    @Test
    void oneOfValidation() {
        List<String> allowed = List.of("top", "mid", "adc");
        Q q = new Q(Map.of("role", "mid", "invalidRole", "jungle", "empty", ""));

        assertEquals("mid", q.oneOf("role", allowed, "top"));
        assertEquals("top", q.oneOf("empty", allowed, "top"));
        assertEquals("top", q.oneOf("missing", allowed, "top"));

        AppException ex = assertThrows(AppException.class, () -> q.oneOf("invalidRole", allowed, "top"));
        assertEquals(400, ex.status());
    }

    @Test
    void regexValidation() {
        String versionRegex = "^\\d+\\.\\d+$";
        Q q = new Q(Map.of("patch", "14.23", "badPatch", "v14.23", "empty", ""));

        assertEquals("14.23", q.regex("patch", versionRegex, "latest"));
        assertEquals("latest", q.regex("empty", versionRegex, "latest"));
        assertEquals("latest", q.regex("missing", versionRegex, "latest"));

        AppException ex = assertThrows(AppException.class, () -> q.regex("badPatch", versionRegex, "latest"));
        assertEquals(400, ex.status());
    }

    @Test
    void integerValidation() {
        Q q = new Q(Map.of("count", "50", "low", "0", "high", "200", "notInt", "abc", "empty", ""));

        assertEquals(50, q.integer("count", 1, 100, 10));
        assertEquals(10, q.integer("empty", 1, 100, 10));
        assertEquals(10, q.integer("missing", 1, 100, 10));

        AppException exNotInt = assertThrows(AppException.class, () -> q.integer("notInt", 1, 100, 10));
        assertEquals(400, exNotInt.status());

        AppException exLow = assertThrows(AppException.class, () -> q.integer("low", 1, 100, 10));
        assertEquals(400, exLow.status());

        AppException exHigh = assertThrows(AppException.class, () -> q.integer("high", 1, 100, 10));
        assertEquals(400, exHigh.status());
    }
}
