package com.lolstats.live;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.data.Catalog;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LiveNamesTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private Db db;
    private Catalog catalog;
    private LiveNames liveNames;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        catalog = mock(Catalog.class);
        liveNames = new LiveNames(db, catalog);
    }

    @Test
    void getThrowsWhenCatalogHasNoLatestPatch() {
        when(catalog.latestPatch()).thenReturn(null);
        assertThrows(AppException.class, () -> liveNames.get());
    }

    @Test
    void getLoadsAndCachesData() throws Exception {
        when(catalog.latestPatch()).thenReturn("14.23.1");

        when(db.rows(contains("FROM champions WHERE patch = ?"), eq("14.23.1"))).thenReturn(List.of(
                Map.of("key", 103, "name", "Ahri", "tags", List.of("Mage", "Assassin"))));

        when(db.one(contains("WHERE version = ? AND kind = 'spells'"), eq("14.23.1"))).thenReturn(Map.of(
                "data", OM.readTree("{\"data\":{\"Flash\":{\"key\":\"4\",\"name\":\"Flash\"}}}")));

        when(db.one(contains("WHERE version = ? AND kind = 'runes'"), eq("14.23.1"))).thenReturn(Map.of(
                "data", OM.readTree("[{\"id\":8000,\"name\":\"Precision\",\"slots\":[{\"runes\":[{\"id\":8010,\"name\":\"Conqueror\"}]}]}]")));

        LiveNames.Names names = liveNames.get();
        assertEquals("14.23.1", names.patch());
        assertEquals("Ahri", names.champion(103));
        assertEquals("999", names.champion(999)); // fallback to key
        assertEquals("Flash", names.spell(4));
        assertEquals("12", names.spell(12)); // fallback
        assertEquals("Conqueror", names.rune(8010));
        assertEquals("Precision", names.style(8000));

        // Call again to verify cache
        LiveNames.Names cached = liveNames.get();
        assertSame(names, cached);
        verify(db, times(1)).rows(anyString(), any());
    }
}
