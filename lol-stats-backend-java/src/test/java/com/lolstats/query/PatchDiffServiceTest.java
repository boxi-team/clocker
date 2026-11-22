package com.lolstats.query;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.Db;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PatchDiffServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private Db db;
    private PatchDiffService service;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        service = new PatchDiffService(db);
    }

    @Test
    void compareVersionsComparesCorrectly() {
        assertTrue(PatchDiffService.compareVersions("14.22.1", "14.23.1") < 0);
        assertTrue(PatchDiffService.compareVersions("15.1.0", "14.23.1") > 0);
        assertEquals(0, PatchDiffService.compareVersions("14.23", "14.23.0"));
        assertEquals(0, PatchDiffService.compareVersions("14.23.1", "14.23.1"));
    }

    @Test
    void previousPatchFindsImmediatePredecessor() {
        when(db.rows("SELECT version FROM patches")).thenReturn(List.of(
                Map.of("version", "14.21.1"),
                Map.of("version", "14.22.1"),
                Map.of("version", "14.23.1")));

        assertEquals("14.22.1", service.previousPatch("14.23.1"));
        assertEquals("14.21.1", service.previousPatch("14.22.1"));
        assertNull(service.previousPatch("14.21.1")); // oldest
    }

    @Test
    void patchChangesReturnsNullWhenNoPreviousPatch() {
        when(db.rows("SELECT version FROM patches")).thenReturn(List.of(
                Map.of("version", "14.23.1")));

        assertNull(service.patchChanges("14.23.1"));
    }

    @Test
    void patchChangesDetectsAddedAndChangedChampionsAndItems() throws Exception {
        when(db.rows("SELECT version FROM patches")).thenReturn(List.of(
                Map.of("version", "14.22.1"),
                Map.of("version", "14.23.1")));

        // Champion in prev: Ahri with hp 500
        when(db.rows(contains("FROM champions WHERE patch = ?"), eq("14.22.1"))).thenReturn(List.of(
                Map.of("key", 103, "id", "Ahri", "name", "Ahri", "title", "Fox", "partype", "Mana",
                        "tags", List.of("Mage"), "info", OM.readTree("{}"),
                        "stats", OM.readTree("{\"hp\":500}"), "spells", OM.readTree("[]"))));

        // Champion in curr: Ahri with hp 550, and new champion Annie (1)
        when(db.rows(contains("FROM champions WHERE patch = ?"), eq("14.23.1"))).thenReturn(List.of(
                Map.of("key", 103, "id", "Ahri", "name", "Ahri", "title", "Fox", "partype", "Mana",
                        "tags", List.of("Mage"), "info", OM.readTree("{}"),
                        "stats", OM.readTree("{\"hp\":550}"), "spells", OM.readTree("[]")),
                Map.of("key", 1, "id", "Annie", "name", "Annie", "title", "Child", "partype", "Mana",
                        "tags", List.of("Mage"), "info", OM.readTree("{}"),
                        "stats", OM.readTree("{\"hp\":500}"), "spells", OM.readTree("[]"))));

        // Items in prev and curr
        when(db.one(contains("WHERE version = ? AND kind = 'items'"), eq("14.22.1"))).thenReturn(Map.of(
                "data", OM.readTree("{\"data\":{\"3089\":{\"name\":\"Rabadon\",\"gold\":{\"total\":3600}}}}")));
        when(db.one(contains("WHERE version = ? AND kind = 'items'"), eq("14.23.1"))).thenReturn(Map.of(
                "data", OM.readTree("{\"data\":{\"3089\":{\"name\":\"Rabadon\",\"gold\":{\"total\":3500}}}}")));

        Map<String, Object> changes = service.patchChanges("14.23.1");
        assertNotNull(changes);
        assertEquals("14.22.1", changes.get("previousVersion"));

        @SuppressWarnings("unchecked")
        Map<String, Object> champs = (Map<String, Object>) changes.get("champions");
        @SuppressWarnings("unchecked")
        List<Object> addedChamps = (List<Object>) champs.get("added");
        @SuppressWarnings("unchecked")
        List<Object> changedChamps = (List<Object>) champs.get("changed");

        assertEquals(1, addedChamps.size());
        assertEquals(1, changedChamps.size());

        @SuppressWarnings("unchecked")
        Map<String, Object> items = (Map<String, Object>) changes.get("items");
        @SuppressWarnings("unchecked")
        List<Object> changedItems = (List<Object>) items.get("changed");
        assertEquals(1, changedItems.size());
    }
}
