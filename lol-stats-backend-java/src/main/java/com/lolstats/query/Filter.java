package com.lolstats.query;

import java.util.ArrayList;
import java.util.List;

/**
 * Analytics filter. {@code tiers} null = all tiers, {@code region} null = all regions, {@code role} optional.
 */
public record Filter(String patch, int queueId, List<String> tiers, String region, String role) {

    /** Positional SQL parameters: {@code add(x)} appends x and returns the "?" to put in the SQL text. */
    public static final class P {
        private final List<Object> values = new ArrayList<>();

        public String add(Object v) {
            values.add(v);
            return "?";
        }

        public Object[] args() {
            return values.toArray();
        }
    }

    /** Conditions shared by {@code matches} and {@code match_participants} (both carry these columns). */
    public List<String> conditions(P p, String a) {
        List<String> c = new ArrayList<>();
        c.add(a + ".patch = " + p.add(patch));
        c.add(a + ".queue_id = " + p.add(queueId));
        if (tiers != null) c.add(a + ".tier_bucket = ANY(string_to_array(" + p.add(String.join(",", tiers)) + ", ','))");
        if (region != null) c.add(a + ".region = " + p.add(region));
        return c;
    }
}
