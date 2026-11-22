package com.lolstats.data;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.common.ErrorCode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CatalogTest {
    private static final ObjectMapper OM = new ObjectMapper();
    private Db db;
    private Catalog catalog;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        catalog = new Catalog(db);
    }

    @Test
    void latestPatchReturnsVersionOrNull() {
        when(db.one(anyString())).thenReturn(Map.of("version", "14.23.1"));
        assertEquals("14.23.1", catalog.latestPatch());

        when(db.one(anyString())).thenReturn(null);
        assertNull(catalog.latestPatch());
    }

    @Test
    void resolveAnalyticsPatchExplicitVersion() {
        assertEquals("14.22", catalog.resolveAnalyticsPatch("14.22"));
    }

    @Test
    void resolveAnalyticsPatchLatestWithData() {
        when(db.rows(anyString())).thenReturn(List.of(
                Map.of("minor", "14.23"),
                Map.of("minor", "14.22")));

        assertEquals("14.23,14.22", catalog.resolveAnalyticsPatch("latest"));
    }

    @Test
    void resolveAnalyticsPatchLatestThrowsWhenNoData() {
        when(db.rows(anyString())).thenReturn(List.of());
        AppException ex = assertThrows(AppException.class, () -> catalog.resolveAnalyticsPatch("latest"));
        assertEquals(503, ex.status());
        assertEquals(ErrorCode.DATA_NOT_READY, ex.code());
    }

    @Test
    void resolveStaticPatchExplicitVersion() {
        assertEquals("14.22.1", catalog.resolveStaticPatch("14.22.1"));
    }

    @Test
    void resolveStaticPatchLatestThrowsWhenNoData() {
        when(db.one(anyString())).thenReturn(null);
        AppException ex = assertThrows(AppException.class, () -> catalog.resolveStaticPatch("latest"));
        assertEquals(503, ex.status());
        assertEquals(ErrorCode.DATA_NOT_READY, ex.code());
    }

    @Test
    void resolveStaticPatchLatestSuccess() {
        when(db.one(anyString())).thenReturn(Map.of("version", "14.23.1"));
        assertEquals("14.23.1", catalog.resolveStaticPatch("latest"));
    }

    @Test
    void resolveChampionThrowsWhenDataNotReady() {
        when(db.one(anyString())).thenReturn(null);
        assertThrows(AppException.class, () -> catalog.resolveChampion("Ahri"));
    }

    @Test
    void resolveChampionByName() throws Exception {
        when(db.one(contains("FROM patches"))).thenReturn(Map.of("version", "14.23.1"));
        when(db.one(contains("FROM champions"), eq("14.23.1"), eq("Ahri"))).thenReturn(Map.of(
                "key", 103,
                "id", "Ahri",
                "name", "Ahri",
                "image", OM.readTree("{\"full\":\"Ahri.png\"}")));

        Catalog.ChampionRef ref = catalog.resolveChampion("Ahri");
        assertEquals(103, ref.key());
        assertEquals("Ahri", ref.id());
        assertEquals("Ahri", ref.name());
        assertEquals("Ahri.png", ref.imageFull());
    }

    @Test
    void resolveChampionByNumericKey() throws Exception {
        when(db.one(contains("FROM patches"))).thenReturn(Map.of("version", "14.23.1"));
        when(db.one(contains("FROM champions"), eq("14.23.1"), eq(103))).thenReturn(Map.of(
                "key", 103,
                "id", "Ahri",
                "name", "Ahri",
                "image", OM.readTree("{\"full\":\"Ahri.png\"}")));

        Catalog.ChampionRef ref = catalog.resolveChampion("103");
        assertEquals(103, ref.key());
        assertEquals("Ahri", ref.id());
    }

    @Test
    void resolveChampionNotFoundThrows() {
        when(db.one(contains("FROM patches"))).thenReturn(Map.of("version", "14.23.1"));
        when(db.one(contains("FROM champions"), any(), any())).thenReturn(null);

        AppException ex = assertThrows(AppException.class, () -> catalog.resolveChampion("UnknownChamp"));
        assertEquals(404, ex.status());
        assertEquals(ErrorCode.CHAMPION_NOT_FOUND, ex.code());
    }

    @Test
    void championIndexBuildsMap() throws Exception {
        when(db.one(contains("FROM patches"))).thenReturn(Map.of("version", "14.23.1"));
        when(db.rows(contains("FROM champions"), eq("14.23.1"))).thenReturn(List.of(
                Map.of("key", 103, "id", "Ahri", "name", "Ahri", "image", OM.readTree("{\"full\":\"Ahri.png\"}")),
                Map.of("key", 1, "id", "Annie", "name", "Annie", "image", OM.readTree("{\"full\":\"Annie.png\"}"))));

        Catalog.ChampionIndex index = catalog.championIndex();
        assertEquals("14.23.1", index.patch());
        assertEquals(2, index.byKey().size());
        assertEquals("Ahri", index.byKey().get(103).name());
        assertEquals("Annie", index.byKey().get(1).name());
    }
}
