package com.lolstats.auth;

import static com.lolstats.common.Api.obj;

import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.common.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Email accounts: register, verify the emailed code, resend it, log in. */
@Service
public class AuthService {
    static final Duration CODE_TTL = Duration.ofMinutes(15);
    static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    static final int MAX_CODE_ATTEMPTS = 5;
    static final Duration SESSION_TTL = Duration.ofDays(30);
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final Db db;
    private final Mailer mailer;
    private final TransactionTemplate tx;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();
    // Compared against when the email is unknown, so a login takes as long whether the account exists or not.
    private final String dummyHash = encoder.encode("not-a-real-password");

    public AuthService(Db db, Mailer mailer, TransactionTemplate tx) {
        this.db = db;
        this.mailer = mailer;
        this.tx = tx;
    }

    // ---------- endpoints ----------

    public Map<String, Object> register(String username, String email, String password, String riotId, String region) {
        String name = trim(username);
        String mail = normalizeEmail(email);
        if (name.isEmpty() || name.length() > 32) throw AppException.invalid("username", "Required, at most 32 characters");
        if (!EMAIL.matcher(mail).matches() || mail.length() > 254) throw AppException.invalid("email", "Not a valid email");
        if (password == null || password.length() < 6 || password.length() > 72) {
            throw AppException.invalid("password", "Must be 6 to 72 characters");
        }
        String reg = trim(region).isEmpty() ? "EUW" : trim(region);
        String riot = trim(riotId);
        if (riot.length() > 30 || reg.length() > 10) throw AppException.invalid("riotId", "Too long");

        Map<String, Object> existing = findByEmail(mail);
        if (existing != null && Db.b(existing, "email_verified")) throw emailTaken();
        String code = newCode();
        if (existing != null) {
            // Unverified account: whoever proves the inbox sets the password, so nobody can squat someone else's email.
            long wait = resendWait(existing);
            if (wait > 0) throw resendTooSoon(wait);
            tx.executeWithoutResult(status -> {
                db.update("UPDATE users SET password_hash = ?, display_name = ?, verification_code = ?, "
                                + "verification_expires_at = ?, verification_attempts = 0, linked_riot_id = ?, "
                                + "linked_region = ?, updated_at = now() WHERE id = ?",
                        encoder.encode(password), name, code, Timestamp.from(Instant.now().plus(CODE_TTL)),
                        riot.isEmpty() ? null : riot, riot.isEmpty() ? null : reg, existing.get("id"));
                db.update("DELETE FROM auth_sessions WHERE user_id = ?", existing.get("id"));
                sendCode(mail, code);
            });
            return obj("status", "PENDING_VERIFICATION", "email", mail);
        }
        try {
            // Insert and send together: if the email cannot be sent the account is not created, so the user can retry.
            tx.executeWithoutResult(status -> {
                db.update("INSERT INTO users (email, password_hash, display_name, auth_provider, email_verified, "
                                + "verification_code, verification_expires_at, verification_attempts, linked_riot_id, "
                                + "linked_region) VALUES (?,?,?,'email',false,?,?,0,?,?)",
                        mail, encoder.encode(password), name, code, Timestamp.from(Instant.now().plus(CODE_TTL)),
                        riot.isEmpty() ? null : riot, riot.isEmpty() ? null : reg);
                sendCode(mail, code);
            });
        } catch (DuplicateKeyException e) {
            throw emailTaken(); // two registrations with the same email at the same moment
        }
        return obj("status", "PENDING_VERIFICATION", "email", mail);
    }

    public Map<String, Object> verifyEmail(String email, String code) {
        Map<String, Object> u = findByEmail(normalizeEmail(email));
        if (u == null) throw AppException.notFound(ErrorCode.NOT_FOUND, "No account with this email.");
        if (Db.b(u, "email_verified")) throw AppException.invalidMessage("This email is already verified. Please log in.");
        String expected = Db.s(u, "verification_code");
        Object expires = u.get("verification_expires_at");
        if (expected == null || expires == null || Instant.now().isAfter((Instant) expires)) {
            throw new AppException(400, ErrorCode.CODE_EXPIRED, "The code has expired. Request a new one.");
        }
        if (!sameCode(expected, trim(code))) {
            int attempts = Db.i(u, "verification_attempts") + 1;
            if (attempts >= MAX_CODE_ATTEMPTS) {
                db.update("UPDATE users SET verification_code = NULL, verification_expires_at = NULL, "
                        + "verification_attempts = 0 WHERE id = ?", u.get("id"));
                throw new AppException(400, ErrorCode.CODE_EXPIRED, "Too many wrong codes. Request a new one.");
            }
            db.update("UPDATE users SET verification_attempts = ? WHERE id = ?", attempts, u.get("id"));
            throw new AppException(400, ErrorCode.INVALID_CODE, "The code is not correct.");
        }
        db.update("UPDATE users SET email_verified = true, verification_code = NULL, verification_expires_at = NULL, "
                + "verification_attempts = 0, updated_at = now() WHERE id = ?", u.get("id"));
        return session(findByEmail(Db.s(u, "email")));
    }

    public Map<String, Object> resendCode(String email) {
        Map<String, Object> u = findByEmail(normalizeEmail(email));
        if (u == null) throw AppException.notFound(ErrorCode.NOT_FOUND, "No account with this email.");
        if (Db.b(u, "email_verified")) throw AppException.invalidMessage("This email is already verified. Please log in.");
        long wait = resendWait(u);
        if (wait > 0) throw resendTooSoon(wait);
        issueCode(u);
        return obj("status", "CODE_SENT", "email", Db.s(u, "email"));
    }

    public Map<String, Object> login(String email, String password) {
        Map<String, Object> u = findByEmail(normalizeEmail(email));
        String hash = u == null ? null : Db.s(u, "password_hash");
        boolean ok = encoder.matches(password == null ? "" : password, hash == null ? dummyHash : hash);
        if (!ok || hash == null) {
            throw new AppException(401, ErrorCode.INVALID_CREDENTIALS, "Invalid email or password.");
        }
        if (!Db.b(u, "email_verified")) {
            // The login page tells the user a fresh code is on its way; a mail failure still leaves the resend button.
            if (resendWait(u) <= 0) {
                try {
                    issueCode(u);
                } catch (AppException ignored) {
                    // logged by Mailer
                }
            }
            throw new AppException(403, ErrorCode.EMAIL_NOT_VERIFIED, "Please verify your email first.");
        }
        return session(u);
    }

    /** Ends the session of a "Bearer token" header. Unknown or missing tokens are ignored. */
    public void logout(String authorization) {
        String token = bearer(authorization);
        if (!token.isEmpty()) db.update("DELETE FROM auth_sessions WHERE token_hash = ?", sha256(token));
    }

    /** The user behind a "Bearer token" header, or 401. */
    public Map<String, Object> me(String authorization) {
        String token = bearer(authorization);
        Map<String, Object> u = token.isEmpty() ? null : db.one(
                "SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id "
                        + "WHERE s.token_hash = ? AND s.expires_at > now()", sha256(token));
        if (u == null) throw new AppException(401, ErrorCode.UNAUTHORIZED, "Not logged in or the session has expired.");
        return userJson(u);
    }

    // ---------- helpers ----------

    private Map<String, Object> findByEmail(String email) {
        return db.one("SELECT * FROM users WHERE lower(email) = ? AND auth_provider = 'email'", email);
    }

    /** Seconds until a new code may be sent; 0 or less means now. The previous code was sent CODE_TTL before it expires. */
    private static long resendWait(Map<String, Object> u) {
        Object expires = u.get("verification_expires_at");
        if (expires == null) return 0;
        Instant sentAt = ((Instant) expires).minus(CODE_TTL);
        return Duration.between(Instant.now(), sentAt.plus(RESEND_COOLDOWN)).toSeconds();
    }

    private static AppException resendTooSoon(long wait) {
        return new AppException(429, ErrorCode.RATE_LIMITED,
                "Please wait " + wait + " seconds before requesting a new code.", null, (int) wait);
    }

    private void issueCode(Map<String, Object> u) {
        String code = newCode();
        tx.executeWithoutResult(status -> {
            db.update("UPDATE users SET verification_code = ?, verification_expires_at = ?, verification_attempts = 0, "
                    + "updated_at = now() WHERE id = ?", code, Timestamp.from(Instant.now().plus(CODE_TTL)), u.get("id"));
            sendCode(Db.s(u, "email"), code);
        });
    }

    private Map<String, Object> session(Map<String, Object> u) {
        db.update("DELETE FROM auth_sessions WHERE expires_at <= now()"); // tiny table, so cleaning on login is enough
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        db.update("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?,?,?)",
                sha256(token), u.get("id"), Timestamp.from(Instant.now().plus(SESSION_TTL)));
        return obj("token", token, "user", userJson(u));
    }

    private void sendCode(String email, String code) {
        mailer.send(email, "Your Boxi.GG verification code",
                "Your verification code is: " + code + "\n\nIt expires in " + CODE_TTL.toMinutes() + " minutes.\n"
                        + "If you did not create a Boxi.GG account, you can ignore this email.");
    }

    private String newCode() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    private static AppException emailTaken() {
        return new AppException(409, ErrorCode.EMAIL_TAKEN, "An account with this email already exists.");
    }

    // ---------- pure logic (unit tested) ----------

    /** The user shape the frontend expects. */
    static Map<String, Object> userJson(Map<String, Object> u) {
        return obj(
                "id", String.valueOf(u.get("id")),
                "method", Db.s(u, "auth_provider"),
                "displayName", Db.s(u, "display_name"),
                "email", Db.s(u, "email"),
                "avatar", Db.s(u, "avatar_url"),
                "riotAccount", riotAccount(Db.s(u, "linked_riot_id"), Db.s(u, "linked_region")));
    }

    /** "Name#TAG" -> {name, rawName, tag, region}; without "#" the tag is the region, as in the frontend. Null if empty. */
    static Map<String, Object> riotAccount(String riotId, String region) {
        if (riotId == null || riotId.isBlank()) return null;
        String[] parts = riotId.split("#", 2);
        String name = parts[0].trim();
        String tag = parts.length > 1 && !parts[1].isBlank() ? parts[1].trim() : (region == null ? "" : region);
        return obj("name", name + "#" + tag, "rawName", name, "tag", tag, "region", region);
    }

    static String normalizeEmail(String email) {
        return trim(email).toLowerCase();
    }

    static boolean sameCode(String expected, String given) {
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
    }

    static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    static String bearer(String authorization) {
        return authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7).trim() : "";
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }
}