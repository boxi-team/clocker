package com.lolstats.web;

import static com.lolstats.common.Api.ok;

import com.lolstats.common.Api;
import com.lolstats.common.AppException;
import com.lolstats.common.Domain;
import com.lolstats.common.Q;
import com.lolstats.live.LiveGameService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Live games (Riot spectator API). */
@RestController
@RequestMapping("/v1")
public class LiveController {
    private final LiveGameService live;

    public LiveController(LiveGameService live) {
        this.live = live;
    }

    /** GET /v1/players/{region}/{gameName}/{tagLine}/live - the player's active game, or 404 NOT_IN_GAME. */
    @GetMapping("/players/{region}/{gameName}/{tagLine}/live")
    public ResponseEntity<Object> playerLive(@PathVariable String region, @PathVariable String gameName,
                                             @PathVariable String tagLine) {
        Q q = new Q(Map.of("region", region, "gameName", gameName, "tagLine", tagLine));
        String r = q.oneOf("region", Domain.REGIONS, null);
        return Api.cached(10, ok(live.liveGame(r, q.str("gameName", 16, null), q.str("tagLine", 5, null))));
    }

    /** GET /v1/live/featured?region=EUW - featured live games. Accepts "EUW" or "euw1"; default euw1. */
    @GetMapping("/live/featured")
    public ResponseEntity<Object> featured(@RequestParam(required = false) String region) {
        String platform = region == null || region.isEmpty() ? "euw1" : Domain.platformOf(region);
        if (platform == null) throw AppException.invalid("region", "Unknown region. Use for example EUW or euw1");
        return Api.cached(30, ok(live.featured(platform)));
    }
}
