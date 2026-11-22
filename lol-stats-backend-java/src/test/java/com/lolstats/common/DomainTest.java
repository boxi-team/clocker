package com.lolstats.common;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.Test;

class DomainTest {

    @Test
    void platformOfResolvesPlatformAndLabel() {
        assertNull(Domain.platformOf(null));
        assertEquals("euw1", Domain.platformOf("euw1"));
        assertEquals("euw1", Domain.platformOf("EUW1"));
        assertEquals("euw1", Domain.platformOf("EUW"));
        assertEquals("eun1", Domain.platformOf("EUNE"));
        assertEquals("na1", Domain.platformOf("NA"));
        assertEquals("kr", Domain.platformOf("KR"));
        assertEquals("br1", Domain.platformOf("BR"));
        assertEquals("la1", Domain.platformOf("LAN"));
        assertEquals("la2", Domain.platformOf("LAS"));
        assertEquals("oc1", Domain.platformOf("OCE"));
        assertNull(Domain.platformOf("INVALID"));
    }

    @Test
    void regionFromMatchIdExtractsRegion() {
        assertEquals("euw1", Domain.regionFromMatchId("EUW1_123456789"));
        assertEquals("kr", Domain.regionFromMatchId("KR_987654321"));
        assertEquals("na1", Domain.regionFromMatchId("NA1_111"));
        assertNull(Domain.regionFromMatchId("UNKNOWN_123"));
    }

    @Test
    void queuesLookupByNameIdAndRiot() {
        Domain.QueueInfo solo = Domain.queue("ranked_solo");
        assertEquals("ranked_solo", solo.name());
        assertEquals(420, solo.id());
        assertEquals("RANKED_SOLO_5x5", solo.riot());

        Domain.QueueInfo flex = Domain.queue("ranked_flex");
        assertEquals("ranked_flex", flex.name());
        assertEquals(440, flex.id());
        assertEquals("RANKED_FLEX_SR", flex.riot());

        assertThrows(NoSuchElementException.class, () -> Domain.queue("unknown"));

        assertEquals(solo, Domain.queueFromId(420));
        assertEquals(flex, Domain.queueFromId(440));
        assertNull(Domain.queueFromId(999));

        assertEquals(solo, Domain.queueFromRiot("RANKED_SOLO_5x5"));
        assertEquals(flex, Domain.queueFromRiot("RANKED_FLEX_SR"));
        assertNull(Domain.queueFromRiot("ARAM"));
    }

    @Test
    void tierFilterExpansions() {
        assertNull(Domain.tierFilterToBuckets("all"));
        assertEquals(List.of("gold"), Domain.tierFilterToBuckets("gold"));
        assertEquals(List.of("master", "grandmaster", "challenger"), Domain.tierFilterToBuckets("master_plus"));
        assertEquals(List.of("diamond", "master", "grandmaster", "challenger"), Domain.tierFilterToBuckets("diamond_plus"));
        assertEquals(List.of("emerald", "diamond", "master", "grandmaster", "challenger"), Domain.tierFilterToBuckets("emerald_plus"));
    }

    @Test
    void rolesAndRoutingConstants() {
        assertTrue(Domain.ROLES.containsAll(List.of("top", "jungle", "mid", "adc", "support")));
        assertEquals("top", Domain.ROLE_FROM_RIOT.get("TOP"));
        assertEquals("jungle", Domain.ROLE_FROM_RIOT.get("JUNGLE"));
        assertEquals("mid", Domain.ROLE_FROM_RIOT.get("MIDDLE"));
        assertEquals("adc", Domain.ROLE_FROM_RIOT.get("BOTTOM"));
        assertEquals("support", Domain.ROLE_FROM_RIOT.get("UTILITY"));

        assertEquals("europe", Domain.ROUTING.get("euw1"));
        assertEquals("europe", Domain.ROUTING.get("eun1"));
        assertEquals("americas", Domain.ROUTING.get("na1"));
        assertEquals("asia", Domain.ROUTING.get("kr"));
        assertEquals("sea", Domain.ROUTING.get("oc1"));
    }
}
