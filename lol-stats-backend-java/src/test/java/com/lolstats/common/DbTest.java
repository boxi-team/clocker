package com.lolstats.common;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class DbTest {
    private static final ObjectMapper OM = new ObjectMapper();

    @Test
    void mapAccessorsExtractValues() throws Exception {
        JsonNode jsonNode = OM.readTree("{\"key\":\"val\"}");
        Map<String, Object> row = Map.of(
                "intVal", 42,
                "longVal", 1000L,
                "doubleVal", 3.14,
                "strVal", "hello",
                "boolVal", true,
                "jsonVal", jsonNode,
                "listVal", List.of("a", "b"));

        assertEquals(42, Db.i(row, "intVal"));
        assertEquals(1000L, Db.l(row, "longVal"));
        assertEquals(3.14, Db.d(row, "doubleVal"));
        assertEquals("hello", Db.s(row, "strVal"));
        assertTrue(Db.b(row, "boolVal"));
        assertEquals(jsonNode, Db.json(row, "jsonVal"));
        assertEquals(List.of("a", "b"), Db.list(row, "listVal"));
        assertNull(Db.s(row, "missingKey"));
    }

    @Test
    void intArrayFormatting() {
        assertNull(Db.intArray(null));
        assertEquals("{}", Db.intArray(List.of()));
        assertEquals("{1,2,3}", Db.intArray(List.of(1, 2, 3)));
    }

    @Test
    void textArrayFormatting() {
        assertNull(Db.textArray(null));
        assertEquals("{}", Db.textArray(List.of()));
        assertEquals("{\"a\",\"b\",\"c\"}", Db.textArray(List.of("a", "b", "c")));
        assertEquals("{\"quote\\\"inside\",\"slash\\\\inside\"}", Db.textArray(List.of("quote\"inside", "slash\\inside")));
    }

    @Test
    void existsAndOneHelpers() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        Db db = new Db(jdbc, OM);
        assertEquals(jdbc, db.jdbc());
    }
}
