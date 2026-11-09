package gg.boxi.common;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;

/** Response helpers. Maps keep insertion order and allow null values, unlike Map.of. */
public final class Api {
    private Api() {}

    /** obj("a", 1, "b", null) -> ordered map {a:1, b:null} */
    public static Map<String, Object> obj(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    public static Map<String, Object> ok(Object data) {
        return ok(data, Map.of());
    }

    public static Map<String, Object> ok(Object data, Map<String, Object> meta) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("generatedAt", Instant.now().toString());
        m.putAll(meta);
        return obj("data", data, "meta", m);
    }

    public static ResponseEntity<Object> cached(int seconds, Object body) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(seconds, TimeUnit.SECONDS).cachePublic()).body(body);
    }

    public static double round(double n, int digits) {
        double m = Math.pow(10, digits);
        return Math.round(n * m) / m;
    }

    public static double ratio(double a, double b) {
        return b > 0 ? round(a / b, 4) : 0;
    }
}
