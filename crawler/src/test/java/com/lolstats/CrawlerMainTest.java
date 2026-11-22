package com.lolstats;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CrawlerMainTest {
    private static final ObjectMapper OM = new ObjectMapper();

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

    @Test
    void patchOfExtractsMajorMinor() {
        assertEquals("14.23", CrawlerMain.patchOf("14.23.123.456"));
        assertEquals("15.1", CrawlerMain.patchOf("15.1.0"));
    }

    @Test
    void encEncodesParametersProperly() {
        assertEquals("Hello%20World", CrawlerMain.enc("Hello World"));
        assertEquals("G2", CrawlerMain.enc("G2"));
    }

    @Test
    void textOrNullHandlesNode() throws Exception {
        JsonNode node = OM.readTree("{\"name\":\"Ahri\",\"nullField\":null}");
        assertEquals("Ahri", CrawlerMain.textOrNull(node, "name"));
        assertNull(CrawlerMain.textOrNull(node, "nullField"));
        assertNull(CrawlerMain.textOrNull(node, "missing"));
    }

    @Test
    void intArrayFormatsSqlArray() {
        assertNull(CrawlerMain.intArray(null));
        assertEquals("{}", CrawlerMain.intArray(List.of()));
        assertEquals("{1,2,3}", CrawlerMain.intArray(List.of(1, 2, 3)));
    }

    @Test
    void runesOfParsesParticipantPerks() throws Exception {
        String json = """
        {
          "perks": {
            "styles": [
              { "description": "primaryStyle", "style": 8000, "selections": [{ "perk": 8010 }] },
              { "description": "subStyle", "style": 8400, "selections": [{ "perk": 8444 }] }
            ],
            "statPerks": { "offense": 5008, "flex": 5008, "defense": 5001 }
          }
        }
        """;
        JsonNode p = OM.readTree(json);
        CrawlerMain.Runes runes = CrawlerMain.runesOf(p);
        assertNotNull(runes);
        assertEquals(8000, runes.primaryStyle());
        assertEquals(8400, runes.subStyle());
        assertEquals(8010, runes.keystone());
        assertEquals(List.of(8010), runes.primaryPerks());
        assertEquals(List.of(8444), runes.secondaryPerks());
        assertEquals(List.of(5008, 5008, 5001), runes.statShards());
    }

    @Test
    void classifyAndCoreItems() {
        Map<Integer, CrawlerMain.ItemInfo> map = Map.of(
                1001, new CrawlerMain.ItemInfo(true, false, 300),
                3006, new CrawlerMain.ItemInfo(true, false, 1100),
                3031, new CrawlerMain.ItemInfo(false, true, 3400),
                3089, new CrawlerMain.ItemInfo(false, true, 3600),
                3157, new CrawlerMain.ItemInfo(false, true, 3000));

        CrawlerMain.Classified cls = CrawlerMain.classify(List.of(1001, 3006, 3031, 3089, 3157, 0), map);
        assertEquals(3006, cls.boots());
        assertEquals(List.of(3089, 3031, 3157), cls.completedItems());
        assertEquals(List.of(3031, 3089, 3157), cls.coreItems());
    }

    @Test
    void completedInOrderKeepsOrderAndExcludesBoots() {
        Map<Integer, CrawlerMain.ItemInfo> map = Map.of(
                1001, new CrawlerMain.ItemInfo(true, false, 300),
                3031, new CrawlerMain.ItemInfo(false, true, 3400),
                3089, new CrawlerMain.ItemInfo(false, true, 3600));

        List<Integer> inOrder = CrawlerMain.completedInOrder(List.of(1001, 3089, 3031, 3089), map);
        assertEquals(List.of(3089, 3031), inOrder);
    }
}
