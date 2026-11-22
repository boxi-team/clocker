package com.lolstats.riot;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class RiotNotFoundExceptionTest {

    @Test
    void setsMessageAndIsRuntimeException() {
        RiotNotFoundException ex = new RiotNotFoundException("/lol/summoner/v4/summoners/by-name/unknown");
        assertEquals("Riot 404: /lol/summoner/v4/summoners/by-name/unknown", ex.getMessage());
        assertEquals("/lol/summoner/v4/summoners/by-name/unknown", ex.path());
        assertTrue(ex instanceof RuntimeException);
    }
}
