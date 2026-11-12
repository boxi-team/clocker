package com.lolstats.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.postgresql.util.PGobject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Thin helper over JdbcTemplate. Rows come back as ordered maps keyed by column label, with
 * SQL arrays as Lists, json/jsonb as JsonNode and timestamps as Instant.
 */
@Component
public class Db {
    private static final Logger log = LoggerFactory.getLogger(Db.class);
    /** Queries slower than this (ms) are logged. */
    private static final long SLOW_MS = 100;

    private final JdbcTemplate jdbc;
    private final ObjectMapper om;

    public Db(JdbcTemplate jdbc, ObjectMapper om) {
        this.jdbc = jdbc;
        this.om = om;
    }

    public JdbcTemplate jdbc() { return jdbc; }

    private static void logIfSlow(String kind, String sql, long startNanos) {
        long ms = (System.nanoTime() - startNanos) / 1_000_000;
        if (ms >= SLOW_MS) {
            String oneLine = sql.replaceAll("\\s+", " ");
            log.info("[db] slow {} {} ms: {}", kind, ms, oneLine.length() > 140 ? oneLine.substring(0, 140) + "..." : oneLine);
        }
    }

    public List<Map<String, Object>> rows(String sql, Object... args) {
        long t0 = System.nanoTime();
        try {
            return queryRows(sql, args);
        } finally {
            logIfSlow("query", sql, t0);
        }
    }

    private List<Map<String, Object>> queryRows(String sql, Object... args) {
        return jdbc.query(sql, (rs, n) -> {
            ResultSetMetaData md = rs.getMetaData();
            Map<String, Object> row = new LinkedHashMap<>();
            for (int i = 1; i <= md.getColumnCount(); i++) row.put(md.getColumnLabel(i), convert(rs.getObject(i)));
            return row;
        }, args);
    }

    /** First row or null. */
    public Map<String, Object> one(String sql, Object... args) {
        List<Map<String, Object>> r = rows(sql, args);
        return r.isEmpty() ? null : r.get(0);
    }

    public boolean exists(String sql, Object... args) {
        return !rows(sql, args).isEmpty();
    }

    public int update(String sql, Object... args) {
        long t0 = System.nanoTime();
        try {
            return jdbc.update(sql, args);
        } finally {
            logIfSlow("update", sql, t0);
        }
    }

    private Object convert(Object o) {
        try {
            if (o == null) return null;
            if (o instanceof java.sql.Array a) {
                Object[] arr = (Object[]) a.getArray();
                List<Object> out = new ArrayList<>(arr.length);
                for (Object x : arr) out.add(convert(x));
                return out;
            }
            if (o instanceof PGobject p) {
                String t = p.getType();
                if ("json".equals(t) || "jsonb".equals(t)) return p.getValue() == null ? null : om.readTree(p.getValue());
                return p.getValue();
            }
            if (o instanceof Timestamp ts) return ts.toInstant();
            return o;
        } catch (Exception e) {
            throw new IllegalStateException("Cannot convert SQL value", e);
        }
    }

    // ---------- accessors for row maps ----------
    public static int i(Map<String, Object> r, String k) { return ((Number) r.get(k)).intValue(); }
    public static long l(Map<String, Object> r, String k) { return ((Number) r.get(k)).longValue(); }
    public static double d(Map<String, Object> r, String k) { return ((Number) r.get(k)).doubleValue(); }
    public static String s(Map<String, Object> r, String k) { Object v = r.get(k); return v == null ? null : v.toString(); }
    public static boolean b(Map<String, Object> r, String k) { return Boolean.TRUE.equals(r.get(k)); }
    public static JsonNode json(Map<String, Object> r, String k) { return (JsonNode) r.get(k); }

    @SuppressWarnings("unchecked")
    public static List<Object> list(Map<String, Object> r, String k) { return (List<Object>) r.get(k); }

    // ---------- Postgres array literals (bind as text and cast with ?::int[] / ?::text[]) ----------
    public static String intArray(Collection<Integer> v) {
        if (v == null) return null;
        return v.stream().map(String::valueOf).collect(Collectors.joining(",", "{", "}"));
    }

    public static String textArray(Collection<String> v) {
        if (v == null) return null;
        return v.stream().map(s -> "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"")
                .collect(Collectors.joining(",", "{", "}"));
    }
}
