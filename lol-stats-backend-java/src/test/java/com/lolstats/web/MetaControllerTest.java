package com.lolstats.web;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.Db;
import com.lolstats.common.GlobalExceptionHandler;
import com.lolstats.data.Catalog;
import com.lolstats.query.PatchDiffService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class MetaControllerTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private Db db;
    private Catalog catalog;
    private PatchDiffService diffs;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        catalog = mock(Catalog.class);
        diffs = mock(PatchDiffService.class);
        MetaController controller = new MetaController(db, catalog, diffs);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void healthReturnsOk() throws Exception {
        mvc.perform(get("/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ok").value(true));
        verify(db).one("SELECT 1");
    }

    @Test
    void patchesReturnsList() throws Exception {
        when(db.rows(contains("FROM patches"))).thenReturn(List.of(
                Map.of("version", "14.23.1", "locale", "en_US", "syncedAt", "2026-11-18T10:00:00Z")));

        mvc.perform(get("/v1/patches"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].version").value("14.23.1"));
    }

    @Test
    void patchByVersionReturnsNotFoundWhenMissing() throws Exception {
        when(db.one(contains("FROM patches WHERE version = ?"), eq("14.99.1"))).thenReturn(null);

        mvc.perform(get("/v1/patches/14.99.1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void patchByVersionReturnsChanges() throws Exception {
        when(db.one(contains("FROM patches WHERE version = ?"), eq("14.23.1"))).thenReturn(Map.of(
                "version", "14.23.1", "locale", "en_US", "syncedAt", "2026-11-18T10:00:00Z"));
        when(diffs.patchChanges("14.23.1")).thenReturn(Map.of("previousVersion", "14.22.1"));

        mvc.perform(get("/v1/patches/14.23.1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value("14.23.1"))
                .andExpect(jsonPath("$.data.changes.previousVersion").value("14.22.1"));
    }

    @Test
    void staticAssetsReturnCachedResponse() throws Exception {
        when(catalog.resolveStaticPatch("latest")).thenReturn("14.23.1");
        when(db.one(contains("FROM static_assets WHERE version = ? AND kind = ?"), eq("14.23.1"), eq("items")))
                .thenReturn(Map.of("data", OM.readTree("{\"1001\":{\"name\":\"Boots\"}}")));

        mvc.perform(get("/v1/items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.1001.name").value("Boots"))
                .andExpect(jsonPath("$.meta.patch").value("14.23.1"));
    }
}
