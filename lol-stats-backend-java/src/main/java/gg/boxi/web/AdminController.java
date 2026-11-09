package gg.boxi.web;

import static gg.boxi.common.Api.obj;

import gg.boxi.common.AppException;
import gg.boxi.common.Domain;
import gg.boxi.common.ErrorCode;
import gg.boxi.common.Q;
import gg.boxi.config.AppProps;
import gg.boxi.data.SyncService;
import gg.boxi.jobs.JobRow;
import gg.boxi.jobs.JobService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Admin endpoints, protected by the x-admin-token header. */
@RestController
@RequestMapping("/v1/admin")
public class AdminController {
    private static final List<String> APEX = List.of("master", "grandmaster", "challenger");

    private final AppProps props;
    private final SyncService sync;
    private final JobService jobs;

    public AdminController(AppProps props, SyncService sync, JobService jobs) {
        this.props = props;
        this.sync = sync;
        this.jobs = jobs;
    }

    private void requireAdmin(String token) {
        String expected = props.adminToken();
        if (expected.isEmpty() || token == null || !token.equals(expected)) {
            throw new AppException(401, ErrorCode.UNAUTHORIZED, "Missing or invalid x-admin-token");
        }
    }

    @PostMapping("/sync")
    public Object sync(@RequestHeader(value = "x-admin-token", required = false) String token,
                       @RequestParam Map<String, String> query) {
        requireAdmin(token);
        Q q = new Q(query);
        boolean force = q.oneOf("force", List.of("true", "false"), "false").equals("true");
        String version = q.regex("version", "^\\d+\\.\\d+\\.\\d+$", null); // e.g. 16.21.1, to back-fill an older patch
        return obj("data", sync.syncChampions(force, version));
    }

    @PostMapping("/crawl")
    public ResponseEntity<Object> crawl(@RequestHeader(value = "x-admin-token", required = false) String token,
                                        @RequestBody(required = false) Map<String, Object> body) {
        requireAdmin(token);
        Map<String, String> raw = new HashMap<>();
        if (body != null) body.forEach((k, v) -> {
            if (v != null) raw.put(k, String.valueOf(v));
        });
        Q q = new Q(raw);
        String region = q.oneOf("region", Domain.REGIONS, null);
        if (region == null) throw AppException.invalid("region", "Required");
        String tier = q.oneOf("tier", Domain.TIER_BUCKETS, null);
        if (tier == null) throw AppException.invalid("tier", "Required");
        String queue = q.oneOf("queue", Domain.QUEUE_NAMES, "ranked_solo");
        String division = q.oneOf("division", List.of("I", "II", "III", "IV"), null);
        int pages = q.integer("pages", 1, 20, 1);
        int matchesPerPlayer = q.integer("matchesPerPlayer", 1, 100, 10);

        if (!APEX.contains(tier) && division == null) {
            throw AppException.invalidMessage("division is required for iron through diamond");
        }
        JobRow job = jobs.enqueue("crawl",
                obj("region", region, "queue", queue, "tier", tier, "division", division,
                        "pages", pages, "matchesPerPlayer", matchesPerPlayer),
                null, 0);
        return ResponseEntity.accepted().body(obj("data", job.toApi()));
    }
}
