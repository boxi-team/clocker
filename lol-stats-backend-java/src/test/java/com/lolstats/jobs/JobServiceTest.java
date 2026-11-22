package com.lolstats.jobs;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.Db;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JobServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private Db db;
    private JobService service;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        service = new JobService(db, OM);
    }

    @Test
    void playerJobKeyFormatsCorrectly() {
        assertEquals("player:puuid-xyz", JobService.playerJobKey("puuid-xyz"));
    }

    @Test
    void enqueueInsertsNewJob() throws Exception {
        Map<String, Object> row = Map.of(
                "id", "uuid-1", "type", "player", "payload", OM.readTree("{}"),
                "status", "queued", "progress_done", 0, "progress_total", 0,
                "created_at", Instant.now());

        when(db.rows(contains("INSERT INTO jobs"), any(), any(), any(), any())).thenReturn(List.of(row));

        JobRow job = service.enqueue("player", Map.of("puuid", "p1"), "player:p1", 10);
        assertNotNull(job);
        assertEquals("uuid-1", job.id());
    }

    @Test
    void enqueueDeduplicatesAndReturnsActiveJobWhenConflict() throws Exception {
        when(db.rows(contains("INSERT INTO jobs"), any(), any(), any(), any())).thenReturn(List.of());

        Map<String, Object> activeRow = Map.of(
                "id", "uuid-active", "type", "player", "payload", OM.readTree("{}"),
                "status", "running", "progress_done", 5, "progress_total", 20,
                "created_at", Instant.now());

        when(db.one(contains("SELECT * FROM jobs WHERE dedupe_key = ?"), eq("player:p1"))).thenReturn(activeRow);

        JobRow job = service.enqueue("player", Map.of("puuid", "p1"), "player:p1", 10);
        assertNotNull(job);
        assertEquals("uuid-active", job.id());
        assertEquals("running", job.status());
    }

    @Test
    void getJobAndActiveJobFor() throws Exception {
        when(db.one(contains("SELECT * FROM jobs WHERE id = ?::uuid"), eq("u1"))).thenReturn(Map.of(
                "id", "u1", "type", "crawl", "payload", OM.readTree("{}"), "status", "queued",
                "progress_done", 0, "progress_total", 0, "created_at", Instant.now()));

        JobRow job = service.getJob("u1");
        assertNotNull(job);
        assertEquals("u1", job.id());

        when(db.one(contains("SELECT * FROM jobs WHERE id = ?::uuid"), eq("missing"))).thenReturn(null);
        assertNull(service.getJob("missing"));
    }

    @Test
    void workerMethodsExecuteDbUpdates() throws Exception {
        service.failInterrupted();
        verify(db).update(contains("WHERE status = 'running'"));

        when(db.one(contains("FOR UPDATE SKIP LOCKED"))).thenReturn(Map.of(
                "id", "u1", "type", "crawl", "payload", OM.readTree("{}"), "status", "running",
                "progress_done", 0, "progress_total", 0, "created_at", Instant.now()));

        JobRow claimed = service.claim();
        assertNotNull(claimed);
        assertEquals("u1", claimed.id());

        service.progress("u1", 5, 10);
        verify(db).update(contains("progress_done = ?"), eq(5), eq(10), eq("u1"));

        service.succeed("u1", Map.of("matches", 10));
        verify(db).update(contains("status = 'succeeded'"), any(), eq("u1"));

        service.fail("u1", "Rate limit exceeded");
        verify(db).update(contains("status = 'failed'"), eq("Rate limit exceeded"), eq("u1"));
    }
}
