package com.lolstats.ingest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class PlayerServiceTest {
    @Test
    void idNumberOrdersMatchIdsOfOneRegionByAge() {
        assertEquals(4030087057L, PlayerService.idNumber("EUN1_4030087057"));
        assertEquals(123L, PlayerService.idNumber("KR_123"));
        // A newer match has a higher id even when the string comparison says otherwise.
        assertTrue(PlayerService.idNumber("EUN1_10000000000") > PlayerService.idNumber("EUN1_9999999999"));
    }
}
