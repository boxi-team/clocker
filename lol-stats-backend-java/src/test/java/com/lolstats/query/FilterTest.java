package com.lolstats.query;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class FilterTest {

    @Test
    void parameterCounterGeneratesPlaceholders() {
        Filter.P p = new Filter.P();
        assertEquals("?", p.add("val1"));
        assertEquals("?", p.add(100));
        assertArrayEquals(new Object[]{"val1", 100}, p.args());
    }

    @Test
    void conditionsBuildsSqlClauses() {
        // Multi-patch with comma, queueId, tierBuckets, region, role
        Filter f = new Filter("14.22,14.23", 420, List.of("gold", "platinum"), "euw1", "mid");
        Filter.P p = new Filter.P();
        List<String> conditions = f.conditions(p, "m");

        assertEquals(4, conditions.size());
        assertEquals("m.patch = ANY(string_to_array(?, ','))", conditions.get(0));
        assertEquals("m.queue_id = ?", conditions.get(1));
        assertEquals("m.tier_bucket = ANY(string_to_array(?, ','))", conditions.get(2));
        assertEquals("m.region = ?", conditions.get(3));

        assertArrayEquals(new Object[]{"14.22,14.23", 420, "gold,platinum", "euw1"}, p.args());
    }

    @Test
    void conditionsWithoutOptionalFilters() {
        Filter f = new Filter("14.23", 420, null, null, null);
        Filter.P p = new Filter.P();
        List<String> conditions = f.conditions(p, "m");

        assertEquals(2, conditions.size());
        assertEquals("m.patch = ANY(string_to_array(?, ','))", conditions.get(0));
        assertEquals("m.queue_id = ?", conditions.get(1));
        assertArrayEquals(new Object[]{"14.23", 420}, p.args());
    }
}
