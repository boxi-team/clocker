package com.lolstats.ingest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.Db;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ItemServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();
    private Db db;
    private ItemService itemService;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        itemService = new ItemService(db);
    }

    @Test
    void parseDetectsBootsAndCompletedItems() throws Exception {
        JsonNode basicBoots = OM.readTree("{\"name\":\"Boots\",\"gold\":{\"total\":300,\"purchasable\":true},\"tags\":[\"Boots\"],\"into\":[\"3006\"]}");
        ItemService.ItemInfo bInfo = ItemService.parse(basicBoots);
        assertTrue(bInfo.boots());
        assertFalse(bInfo.completed()); // has "into", so not completed
        assertEquals(300, bInfo.cost());

        JsonNode berserkers = OM.readTree("{\"name\":\"Berserker's Greaves\",\"gold\":{\"total\":1100,\"purchasable\":true},\"tags\":[\"Boots\"],\"into\":[]}");
        ItemService.ItemInfo bgInfo = ItemService.parse(berserkers);
        assertTrue(bgInfo.boots());
        assertTrue(bgInfo.completed()); // completed based on cost >= 1000 and empty into

        JsonNode potion = OM.readTree("{\"name\":\"Health Potion\",\"gold\":{\"total\":50,\"purchasable\":true},\"tags\":[\"Consumable\"],\"into\":[]}");
        ItemService.ItemInfo potInfo = ItemService.parse(potion);
        assertFalse(potInfo.boots());
        assertFalse(potInfo.completed());

        JsonNode trinket = OM.readTree("{\"name\":\"Stealth Ward\",\"gold\":{\"total\":0,\"purchasable\":true},\"tags\":[\"Trinket\"],\"into\":[]}");
        ItemService.ItemInfo trInfo = ItemService.parse(trinket);
        assertFalse(trInfo.completed());

        JsonNode rabadon = OM.readTree("{\"name\":\"Rabadon's Deathcap\",\"gold\":{\"total\":3600,\"purchasable\":true},\"tags\":[\"SpellDamage\"],\"into\":[]}");
        ItemService.ItemInfo rabInfo = ItemService.parse(rabadon);
        assertFalse(rabInfo.boots());
        assertTrue(rabInfo.completed());
        assertEquals(3600, rabInfo.cost());
    }

    @Test
    void classifyHandlesNullMapAndEmptySlots() {
        ItemService.Classified c = ItemService.classify(List.of(3006, 3089, 3031, 3157, 0, 0), null);
        assertNull(c.boots());
        assertEquals(List.of(3006, 3089, 3031, 3157), c.completedItems());
        assertEquals(List.of(3006, 3031, 3089), c.coreItems());
    }

    @Test
    void classifyPicksHighestCostBoots() {
        Map<Integer, ItemService.ItemInfo> map = Map.of(
                1001, new ItemService.ItemInfo(true, false, 300),
                3006, new ItemService.ItemInfo(true, false, 1100),
                3089, new ItemService.ItemInfo(false, true, 3600),
                3031, new ItemService.ItemInfo(false, true, 3400),
                3157, new ItemService.ItemInfo(false, true, 3000));

        ItemService.Classified c = ItemService.classify(List.of(1001, 3006, 3089, 3031, 3157, 0), map);
        assertEquals(3006, c.boots());
        assertEquals(List.of(3089, 3031, 3157), c.completedItems());
        assertEquals(List.of(3031, 3089, 3157), c.coreItems());
    }

    @Test
    void completedInOrderKeepsUniqueInPurchaseOrder() {
        Map<Integer, ItemService.ItemInfo> map = Map.of(
                1001, new ItemService.ItemInfo(true, false, 300),
                3006, new ItemService.ItemInfo(true, false, 1100),
                3031, new ItemService.ItemInfo(false, true, 3400),
                3089, new ItemService.ItemInfo(false, true, 3600),
                1055, new ItemService.ItemInfo(false, false, 450));

        assertNull(ItemService.completedInOrder(null, map));
        assertNull(ItemService.completedInOrder(List.of(3031), null));

        List<Integer> purchases = List.of(1055, 1001, 3031, 3006, 3089, 3031); // 3031 bought twice (duplicate)
        List<Integer> result = ItemService.completedInOrder(purchases, map);
        assertEquals(List.of(3031, 3089), result);
    }

    @Test
    void lastBootsPrefersUpgradedBoots() {
        Map<Integer, ItemService.ItemInfo> map = Map.of(
                1001, new ItemService.ItemInfo(true, false, 300),
                3006, new ItemService.ItemInfo(true, false, 1100));

        assertNull(ItemService.lastBoots(null, map));
        assertNull(ItemService.lastBoots(List.of(1001), null));

        assertEquals(1001, ItemService.lastBoots(List.of(1001), map));
        assertEquals(3006, ItemService.lastBoots(List.of(1001, 3006), map));
        assertEquals(3006, ItemService.lastBoots(List.of(3006, 1001), map)); // upgraded still prioritized
    }

    @Test
    void itemsForPatchLoadsFromDbAndCaches() throws Exception {
        JsonNode assetData = OM.readTree("{\"data\":{\"1001\":{\"name\":\"Boots\",\"gold\":{\"total\":300},\"tags\":[\"Boots\"],\"into\":[]}}}");
        when(db.rows(anyString())).thenReturn(List.of(
                Map.of("version", "14.23.1", "data", assetData)));

        Map<Integer, ItemService.ItemInfo> items = itemService.itemsForPatch("14.23");
        assertNotNull(items);
        assertTrue(items.containsKey(1001));

        // Call again to verify cache
        itemService.itemsForPatch("14.23");
        verify(db, times(1)).rows(anyString());

        itemService.clearCache();
        itemService.itemsForPatch("14.23");
        verify(db, times(2)).rows(anyString());
    }
}
