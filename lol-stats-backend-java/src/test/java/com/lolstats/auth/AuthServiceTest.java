package com.lolstats.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AuthServiceTest {

    @Test
    void riotAccountSplitsNameAndTag() {
        Map<String, Object> r = AuthService.riotAccount(" Faker #KR1", "KR");
        assertEquals("Faker#KR1", r.get("name"));
        assertEquals("Faker", r.get("rawName"));
        assertEquals("KR1", r.get("tag"));
        assertEquals("KR", r.get("region"));
    }

    @Test
    void riotAccountWithoutTagUsesRegion() {
        assertEquals("Name#EUW", AuthService.riotAccount("Name", "EUW").get("name"));
        assertEquals("Name#EUW", AuthService.riotAccount("Name#", "EUW").get("name"));
        assertNull(AuthService.riotAccount("  ", "EUW"));
        assertNull(AuthService.riotAccount(null, "EUW"));
    }

    @Test
    void userJsonHasTheFrontendShape() {
        Map<String, Object> row = new HashMap<>();
        row.put("id", "11111111-1111-1111-1111-111111111111");
        row.put("auth_provider", "email");
        row.put("display_name", "Ana");
        row.put("email", "ana@example.com");
        row.put("password_hash", "secret");
        Map<String, Object> u = AuthService.userJson(row);
        assertEquals("email", u.get("method"));
        assertEquals("Ana", u.get("displayName"));
        assertNull(u.get("riotAccount"));
        assertFalse(u.containsKey("password_hash"));
        assertFalse(u.containsKey("passwordHash"));
    }

    @Test
    void helpers() {
        assertEquals("ana@example.com", AuthService.normalizeEmail("  Ana@Example.COM "));
        assertEquals("", AuthService.normalizeEmail(null));
        assertTrue(AuthService.sameCode("123456", "123456"));
        assertFalse(AuthService.sameCode("123456", "123457"));
        assertFalse(AuthService.sameCode("123456", "12345"));
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", AuthService.sha256("abc"));
        assertEquals("tok", AuthService.bearer("Bearer tok "));
        assertEquals("", AuthService.bearer("Basic tok"));
        assertEquals("", AuthService.bearer(null));
    }
}
