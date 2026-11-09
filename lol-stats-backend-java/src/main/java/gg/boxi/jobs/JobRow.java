package gg.boxi.jobs;

import com.fasterxml.jackson.databind.JsonNode;
import gg.boxi.common.Api;
import gg.boxi.common.Db;
import java.time.Instant;
import java.util.Map;

public record JobRow(
        String id,
        String type,
        JsonNode payload,
        String status,
        int progressDone,
        int progressTotal,
        JsonNode result,
        String error,
        Instant createdAt,
        Instant finishedAt) {

    static JobRow from(Map<String, Object> r) {
        return new JobRow(
                Db.s(r, "id"), Db.s(r, "type"), Db.json(r, "payload"), Db.s(r, "status"),
                Db.i(r, "progress_done"), Db.i(r, "progress_total"), Db.json(r, "result"), Db.s(r, "error"),
                (Instant) r.get("created_at"), (Instant) r.get("finished_at"));
    }

    /** API shape of a job. */
    public Map<String, Object> toApi() {
        return Api.obj(
                "id", id,
                "type", type,
                "status", status,
                "progress", Api.obj("done", progressDone, "total", progressTotal),
                "result", result,
                "error", error,
                "createdAt", createdAt,
                "finishedAt", finishedAt);
    }
}
