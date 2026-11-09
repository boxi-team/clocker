package gg.boxi.common;

import java.util.Collection;
import java.util.Map;
import java.util.regex.Pattern;

/** Request parameter validation with defaults. Every failure is a 400 INVALID_PARAMETER naming the field. */
public final class Q {
    private final Map<String, String> m;

    public Q(Map<String, String> m) {
        this.m = m == null ? Map.of() : m;
    }

    private String raw(String name) {
        String v = m.get(name);
        return v == null || v.isEmpty() ? null : v;
    }

    /** Free text; null when absent and no default. */
    public String str(String name, int maxLen, String def) {
        String v = raw(name);
        if (v == null) return def;
        if (v.length() > maxLen) throw AppException.invalid(name, "String must contain at most " + maxLen + " character(s)");
        return v;
    }

    public String oneOf(String name, Collection<String> allowed, String def) {
        String v = raw(name);
        if (v == null) return def;
        if (!allowed.contains(v)) throw AppException.invalid(name, "Invalid enum value. Expected one of: " + String.join(", ", allowed));
        return v;
    }

    public String regex(String name, String regex, String def) {
        String v = raw(name);
        if (v == null) return def;
        if (!Pattern.matches(regex, v)) throw AppException.invalid(name, "Invalid format");
        return v;
    }

    public int integer(String name, int min, int max, int def) {
        String v = raw(name);
        if (v == null) return def;
        int n;
        try {
            n = Integer.parseInt(v);
        } catch (NumberFormatException e) {
            throw AppException.invalid(name, "Expected an integer");
        }
        if (n < min) throw AppException.invalid(name, "Number must be greater than or equal to " + min);
        if (n > max) throw AppException.invalid(name, "Number must be less than or equal to " + max);
        return n;
    }
}
