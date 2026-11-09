package gg.boxi;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import gg.boxi.common.AppException;
import gg.boxi.common.Db;
import gg.boxi.common.Domain;
import gg.boxi.common.Q;
import gg.boxi.config.AppProps;
import gg.boxi.config.AppProps.Limit;
import gg.boxi.ingest.ItemService;
import gg.boxi.ingest.ItemService.Classified;
import gg.boxi.ingest.ItemService.ItemInfo;
import gg.boxi.ingest.MatchIngestService;
import gg.boxi.ingest.MatchIngestService.TimelineInfo;
import gg.boxi.query.Filter;
import gg.boxi.query.PatchDiffService;
import gg.boxi.query.StatLines;
import gg.boxi.riot.RateLimiter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

/** Pure-logic tests; no database or network needed. */
class LogicTest {
    private static final ObjectMapper OM = new ObjectMapper();

    @Test
    void tierFiltersExpandToBuckets() {
        assertNull(Domain.tierFilterToBuckets("all"));
        assertEquals(List.of("gold"), Domain.tierFilterToBuckets("gold"));
        assertEquals(List.of("master", "grandmaster", "challenger"), Domain.tierFilterToBuckets("master_plus"));
        assertEquals(List.of("emerald", "diamond", "master", "grandmaster", "challenger"),
                Domain.tierFilterToBuckets("emerald_plus"));
    }

    @Test
    void regionFromMatchId() {
        assertEquals("euw1", Domain.regionFromMatchId("EUW1_123"));
        assertEquals("kr", Domain.regionFromMatchId("KR_123"));
        assertNull(Domain.regionFromMatchId("XX_1"));
    }

    @Test
    void validationAppliesDefaultsAndRejectsBadValues() {
        Q q = new Q(Map.of("tier", "gold", "count", "500", "patch", "abc"));
        assertEquals("gold", q.oneOf("tier", Domain.TIER_FILTERS, "master_plus"));
        assertEquals("ranked_solo", q.oneOf("queue", Domain.QUEUE_NAMES, "ranked_solo"));
        assertEquals(400, assertThrows(AppException.class, () -> q.integer("count", 1, 100, 20)).status());
        assertThrows(AppException.class, () -> q.regex("patch", "^(latest|\\d+\\.\\d+)$", "latest"));
    }

    @Test
    void wilsonScoreMatchesKnownValues() {
        assertEquals(0, StatLines.wilsonScore(0, 0));
        assertTrue(StatLines.wilsonScore(60, 100) < 60);
        assertTrue(StatLines.wilsonScore(600, 1000) > StatLines.wilsonScore(60, 100)); // more games, tighter bound
    }

    @Test
    void versionsCompareNumerically() {
        assertTrue(PatchDiffService.compareVersions("15.9.1", "15.21.1") < 0);
        assertEquals(0, PatchDiffService.compareVersions("15.21", "15.21.0"));
        assertTrue(PatchDiffService.compareVersions("16.1.1", "15.24.1") > 0);
    }

    @Test
    void filterBuildsPositionalConditions() {
        Filter f = new Filter("15.21", 420, List.of("master", "challenger"), "euw1", null);
        Filter.P p = new Filter.P();
        List<String> c = f.conditions(p, "p");
        assertEquals(4, c.size());
        assertEquals(4, p.args().length);
        assertEquals("master,challenger", p.args()[2]);
    }

    @Test
    void arrayLiterals() {
        assertEquals("{1,2,3}", Db.intArray(List.of(1, 2, 3)));
        assertNull(Db.intArray(null));
        assertEquals("{\"a\",\"b\\\"c\"}", Db.textArray(List.of("a", "b\"c")));
    }

    @Test
    void propsParseRateLimits() {
        AppProps props = new AppProps("", "", "", "20:1000,100:120000", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 120);
        assertEquals(List.of(new Limit(20, 1000), new Limit(100, 120000)), props.limits());
    }

    private static Map<Integer, ItemInfo> items() {
        return Map.of(
                1001, new ItemInfo(true, false, 300),    // basic boots
                3006, new ItemInfo(true, false, 1100),   // upgraded boots
                3031, new ItemInfo(false, true, 3400),
                3089, new ItemInfo(false, true, 3600),
                3157, new ItemInfo(false, true, 3000),
                3020, new ItemInfo(false, true, 1100),
                2003, new ItemInfo(false, false, 50));   // consumable
    }

    @Test
    void itemsAreClassified() {
        Classified c = ItemService.classify(List.of(3006, 1001, 3157, 3089, 3031, 2003), items());
        assertEquals(3006, c.boots());
        assertEquals(List.of(3089, 3031, 3157), c.completedItems()); // most expensive first
        assertEquals(List.of(3031, 3089, 3157), c.coreItems());      // 3 most expensive, ascending
    }

    @Test
    void fewerThanThreeCompletedItemsHaveNoCoreSet() {
        Classified c = ItemService.classify(List.of(3031, 3020, 0, 0, 0, 0), items());
        assertNull(c.boots());
        assertNull(c.coreItems());
    }

    @Test
    void timelineGivesSkillOrderAndStartingItems() throws Exception {
        StringBuilder events = new StringBuilder();
        // Q W E Q Q R Q W ... first five Q's max Q first
        int[] slots = {1, 2, 3, 1, 1, 4, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3};
        for (int s : slots) {
            events.append("{\"type\":\"SKILL_LEVEL_UP\",\"participantId\":2,\"levelUpType\":\"NORMAL\",\"skillSlot\":")
                    .append(s).append(",\"timestamp\":1000},");
        }
        events.append("{\"type\":\"ITEM_PURCHASED\",\"participantId\":2,\"itemId\":1055,\"timestamp\":5000},")
                .append("{\"type\":\"ITEM_PURCHASED\",\"participantId\":2,\"itemId\":2003,\"timestamp\":6000},")
                .append("{\"type\":\"ITEM_UNDO\",\"participantId\":2,\"beforeId\":2003,\"timestamp\":7000},")
                .append("{\"type\":\"ITEM_PURCHASED\",\"participantId\":2,\"itemId\":3340,\"timestamp\":95000},")
                .append("{\"type\":\"ITEM_PURCHASED\",\"participantId\":1,\"itemId\":9999,\"timestamp\":5000}");
        JsonNode tl = OM.readTree("{\"metadata\":{\"participants\":[\"a\",\"b\"]},\"info\":{\"frames\":[{\"events\":["
                + events + "]}]}}");

        TimelineInfo info = MatchIngestService.parseTimeline(tl, "b");
        assertNotNull(info);
        assertEquals("QWEQQRQQWWWWEEEE".substring(0, 15), info.skillOrder());
        assertEquals("Q>W>E", info.skillMaxOrder());
        assertEquals(List.of(1055), info.startingItems()); // undone consumable and late purchase excluded
        assertNull(MatchIngestService.parseTimeline(tl, "unknown"));
    }

    @Test
    void rateLimiterWaitsWhenWindowIsFull() throws Exception {
        AtomicLong now = new AtomicLong(0);
        RateLimiter limiter = new RateLimiter(List.of(new Limit(2, 1000)), now::get);
        limiter.acquire();
        limiter.acquire();
        Thread t = new Thread(() -> {
            try {
                Thread.sleep(50);
            } catch (InterruptedException ignored) {
                // test thread
            }
            now.set(1100); // window slides past the first two requests
        });
        t.start();
        limiter.acquire(); // blocks until the fake clock moves
        assertTrue(now.get() >= 1100);
        t.join();
    }
}
