package gg.boxi.ingest;

import gg.boxi.common.Db;
import java.time.Instant;
import java.util.Map;

public record PlayerRow(
        String puuid,
        String region,
        String gameName,
        String tagLine,
        Integer summonerLevel,
        Integer profileIconId,
        Instant lastRefreshRequestedAt,
        Instant lastRefreshedAt,
        Long lastMatchCreation) {

    static PlayerRow from(Map<String, Object> r) {
        return new PlayerRow(
                Db.s(r, "puuid"), Db.s(r, "region"), Db.s(r, "game_name"), Db.s(r, "tag_line"),
                r.get("summoner_level") == null ? null : Db.i(r, "summoner_level"),
                r.get("profile_icon_id") == null ? null : Db.i(r, "profile_icon_id"),
                (Instant) r.get("last_refresh_requested_at"),
                (Instant) r.get("last_refreshed_at"),
                r.get("last_match_creation") == null ? null : Db.l(r, "last_match_creation"));
    }
}
