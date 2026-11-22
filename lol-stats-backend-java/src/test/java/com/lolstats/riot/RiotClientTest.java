package com.lolstats.riot;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.AppException;
import com.lolstats.common.ErrorCode;
import com.lolstats.config.AppProps;
import org.junit.jupiter.api.Test;

class RiotClientTest {
    private final ObjectMapper om = new ObjectMapper();

    @Test
    void throwsUpstreamErrorWhenApiKeyMissing() {
        AppProps props = new AppProps("", "", "", "", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);
        RiotClient client = new RiotClient(props, om);

        AppException ex = assertThrows(AppException.class, () -> client.account("euw1", "Caps", "G2"));
        assertEquals(502, ex.status());
        assertEquals(ErrorCode.UPSTREAM_ERROR, ex.code());
        assertTrue(ex.getMessage().contains("RIOT_API_KEY is not configured"));
    }
}
