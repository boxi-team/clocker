package gg.boxi.jobs;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import gg.boxi.common.Db;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Job queue stored in the jobs table. */
@Service
public class JobService {
    private final Db db;
    private final ObjectMapper om;

    public JobService(Db db, ObjectMapper om) {
        this.db = db;
        this.om = om;
    }

    public static String playerJobKey(String puuid) {
        return "player:" + puuid;
    }

    private String json(Object o) {
        try {
            return om.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Queue a job. With a dedupe key, an already active job with that key is returned instead. */
    public JobRow enqueue(String type, Object payload, String dedupeKey, int priority) {
        List<Map<String, Object>> rows = db.rows(
                "INSERT INTO jobs (type, payload, dedupe_key, priority) VALUES (?, ?::jsonb, ?, ?) "
                        + "ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued','running') DO NOTHING "
                        + "RETURNING *",
                type, json(payload), dedupeKey, priority);
        if (!rows.isEmpty()) return JobRow.from(rows.get(0));
        return activeJobFor(dedupeKey);
    }

    public JobRow getJob(String id) {
        Map<String, Object> r = db.one("SELECT * FROM jobs WHERE id = ?::uuid", id);
        return r == null ? null : JobRow.from(r);
    }

    public JobRow activeJobFor(String dedupeKey) {
        Map<String, Object> r = db.one(
                "SELECT * FROM jobs WHERE dedupe_key = ? AND status IN ('queued','running') LIMIT 1", dedupeKey);
        return r == null ? null : JobRow.from(r);
    }

    // ---------- worker side ----------
    void failInterrupted() {
        // Jobs left running by a crashed process can never finish.
        db.update("UPDATE jobs SET status = 'failed', error = 'interrupted by restart', finished_at = now() "
                + "WHERE status = 'running'");
    }

    JobRow claim() {
        Map<String, Object> r = db.one(
                "UPDATE jobs SET status = 'running', started_at = now() "
                        + "WHERE id = (SELECT id FROM jobs WHERE status = 'queued' "
                        + "ORDER BY priority DESC, created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *");
        return r == null ? null : JobRow.from(r);
    }

    void progress(String id, int done, int total) {
        db.update("UPDATE jobs SET progress_done = ?, progress_total = ? WHERE id = ?::uuid", done, total, id);
    }

    void succeed(String id, Object result) {
        db.update("UPDATE jobs SET status = 'succeeded', result = ?::jsonb, finished_at = now() WHERE id = ?::uuid",
                json(result), id);
    }

    void fail(String id, String message) {
        db.update("UPDATE jobs SET status = 'failed', error = ?, finished_at = now() WHERE id = ?::uuid", message, id);
    }
}
