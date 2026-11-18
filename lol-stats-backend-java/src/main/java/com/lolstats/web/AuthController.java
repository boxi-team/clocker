package com.lolstats.web;

import static com.lolstats.common.Api.ok;

import com.lolstats.auth.AuthService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Email accounts. Every response is {data} on success or {error:{code,message}} on failure. */
@RestController
@RequestMapping("/v1/auth")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    private static String str(Map<String, Object> body, String key) {
        Object v = body == null ? null : body.get(key);
        return v == null ? null : String.valueOf(v);
    }

    /** Body {username, email, password, riotId, region}. Creates an unverified account and emails a 6-digit code. */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.status(201).body(ok(auth.register(str(body, "username"), str(body, "email"),
                str(body, "password"), str(body, "riotId"), str(body, "region"))));
    }

    /** Body {email, code}. Answers {data:{token, user}}. */
    @PostMapping("/verify-email")
    public Map<String, Object> verifyEmail(@RequestBody(required = false) Map<String, Object> body) {
        return ok(auth.verifyEmail(str(body, "email"), str(body, "code")));
    }

    /** Body {email}. Emails a new code (at most once a minute). */
    @PostMapping("/resend-code")
    public Map<String, Object> resendCode(@RequestBody(required = false) Map<String, Object> body) {
        return ok(auth.resendCode(str(body, "email")));
    }

    /** Body {email, password}. Answers {data:{token, user}}, or EMAIL_NOT_VERIFIED / INVALID_CREDENTIALS. */
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody(required = false) Map<String, Object> body) {
        return ok(auth.login(str(body, "email"), str(body, "password")));
    }

    /** Header "Authorization: Bearer {token}". Answers {data: user}. */
    @GetMapping("/me")
    public Map<String, Object> me(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return ok(auth.me(authorization));
    }
}