package com.lolstats;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CrawlerMainTest {

    @Test
    void parseQuotasKeepsOrderAndValues() {
        Map<String, Integer> q = CrawlerMain.parseQuotas("eun1:250, EUW1:250,na1:200,,kr:200,oc1:100");
        assertEquals(List.of("eun1", "euw1", "na1", "kr", "oc1"), List.copyOf(q.keySet()));
        assertEquals(1000, q.values().stream().mapToInt(Integer::intValue).sum());
    }

    @Test
    void parseQuotasRejectsBadInput() {
        assertThrows(IllegalArgumentException.class, () -> CrawlerMain.parseQuotas("eun1"));
        assertThrows(IllegalArgumentException.class, () -> CrawlerMain.parseQuotas(" , "));
    }

    @Test
    void divisionSharesAddUpToQuota() {
        for (int quota : new int[]{0, 1, 3, 100, 250, 251}) {
            int sum = 0;
            for (int d = 0; d < 4; d++) sum += CrawlerMain.divisionShare(quota, d);
            assertEquals(quota, sum, "quota " + quota);
        }
        assertEquals(63, CrawlerMain.divisionShare(250, 0));
        assertEquals(62, CrawlerMain.divisionShare(250, 3));
    }

    @Test
    void everyDefaultPlatformHasARoute() {
        for (String p : CrawlerMain.parseQuotas(CrawlerMain.QUOTAS).keySet()) {
            assertNotNull(CrawlerMain.ROUTING.get(p), p);
        }
    }
}
