package com.lolstats.jobs;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

class JobRowTest {
    private static final ObjectMapper OM = new ObjectMapper();

    @Test
    void jobRowFromMapAndToApi() throws Exception {
        Instant created = Instant.now().minusSeconds(10);
        Instant finished = Instant.now();
        JsonNode payload = OM.readTree("{\"region\":\"euw1\"}");
        JsonNode result = OM.readTree("{\"stored\":10}");

        Map<String, Object> map = Map.of(
                "id", "e87494f4-52d8-4f8e-9080-d667c30d979b",
                "type", "crawl",
                "payload", payload,
                "status", "succeeded",
                "progress_done", 10,
                "progress_total", 10,
                "result", result,
                "error", "none",
                "created_at", created,
                "finished_at", finished);

        JobRow row = JobRow.from(map);
        assertEquals("e87494f4-52d8-4f8e-9080-d667c30d979b", row.id());
        assertEquals("crawl", row.type());
        assertEquals(payload, row.payload());
        assertEquals("succeeded", row.status());
        assertEquals(10, row.progressDone());
        assertEquals(10, row.progressTotal());
        assertEquals(result, row.result());
        assertEquals("none", row.error());
        assertEquals(created, row.createdAt());
        assertEquals(finished, row.finishedAt());

        Map<String, Object> api = row.toApi();
        assertEquals("e87494f4-52d8-4f8e-9080-d667c30d979b", api.get("id"));
        assertEquals("crawl", api.get("type"));
        assertEquals("succeeded", api.get("status"));
        @SuppressWarnings("unchecked")
        Map<String, Object> prog = (Map<String, Object>) api.get("progress");
        assertEquals(10, prog.get("done"));
        assertEquals(10, prog.get("total"));
        assertEquals(result, api.get("result"));
    }
}
