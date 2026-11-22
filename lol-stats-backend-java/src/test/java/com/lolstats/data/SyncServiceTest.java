package com.lolstats.data;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.Db;
import com.lolstats.config.AppProps;
import com.lolstats.ingest.ItemService;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionTemplate;

class SyncServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private Db db;
    private DDragonClient dd;
    private AppProps props;
    private ItemService items;
    private TransactionTemplate tx;
    private SyncService service;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        dd = mock(DDragonClient.class);
        props = new AppProps("", "", "", "", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);
        items = mock(ItemService.class);
        tx = mock(TransactionTemplate.class);

        doAnswer(invocation -> {
            Consumer<?> callback = invocation.getArgument(0);
            callback.accept(null);
            return null;
        }).when(tx).executeWithoutResult(any());

        service = new SyncService(db, dd, props, OM, items, tx);
    }

    @Test
    void syncChampionsSkipsWhenAlreadySyncedAndNotForced() {
        when(dd.fetchLatestVersion()).thenReturn("14.23.1");
        when(db.exists(contains("FROM patches"), eq("14.23.1"))).thenReturn(true);

        SyncService.SyncResult result = service.syncChampions(false, null);
        assertEquals("14.23.1", result.patch());
        assertFalse(result.synced());
        assertEquals(0, result.champions());
        verify(dd, never()).fetchChampionIds(any());
    }

    @Test
    void syncChampionsForcesSyncWhenSpecified() throws Exception {
        when(dd.fetchLatestVersion()).thenReturn("14.23.1");
        when(dd.fetchChampionIds("14.23.1")).thenReturn(List.of("Ahri"));

        JsonNode champJson = OM.readTree("{\"key\":\"103\",\"id\":\"Ahri\",\"name\":\"Ahri\",\"title\":\"Fox\",\"blurb\":\"b\",\"lore\":\"l\",\"tags\":[\"Mage\"],\"partype\":\"Mana\",\"info\":{},\"stats\":{},\"spells\":[],\"passive\":{},\"skins\":[],\"image\":{}}");
        when(dd.fetchChampionDetail("14.23.1", "Ahri")).thenReturn(champJson);
        when(dd.fetchItems("14.23.1")).thenReturn(OM.readTree("{}"));
        when(dd.fetchRunes("14.23.1")).thenReturn(OM.readTree("[]"));
        when(dd.fetchSummonerSpells("14.23.1")).thenReturn(OM.readTree("{}"));

        SyncService.SyncResult result = service.syncChampions(true, "14.23.1");
        assertTrue(result.synced());
        assertEquals("14.23.1", result.patch());
        assertEquals(1, result.champions());
        verify(items).clearCache();
        verify(db, atLeastOnce()).update(contains("INSERT INTO patches"), eq("14.23.1"), any());
    }
}
