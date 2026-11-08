package com.lolstats.riot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.AppException;
import com.lolstats.common.Domain;
import com.lolstats.common.ErrorCode;
import com.lolstats.config.AppProps;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Riot API client with a per-host rate limiter and retries. Responses are returned as JsonNode;
 * only the fields we read are accessed by callers.
 */
@Component
public class RiotClient {
    private final AppProps props;
    private final ObjectMapper om;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final Map<String, RateLimiter> limiters = new ConcurrentHashMap<>();

    public RiotClient(AppProps props, ObjectMapper om) {
        this.props = props;
        this.om = om;
    }

    private RateLimiter limiterFor(String host) {
        return limiters.computeIfAbsent(host, h -> new RateLimiter(props.limits()));
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private URI urlFor(String host, String path, Map<String, Object> query) {
        String base = props.riotBaseUrl().isEmpty()
                ? "https://" + host + ".api.riotgames.com"
                : props.riotBaseUrl() + "/" + host;
        String qs = query.entrySet().stream()
                .filter(e -> e.getValue() != null)
                .map(e -> e.getKey() + "=" + enc(String.valueOf(e.getValue())))
                .collect(Collectors.joining("&"));
        return URI.create(base + path + (qs.isEmpty() ? "" : "?" + qs));
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted", e);
        }
    }

    /** {@code host} is a platform ("euw1") or a regional route ("europe"). */
    private JsonNode get(String host, String path, Map<String, Object> query) {
        if (props.riotApiKey().isEmpty() && props.riotBaseUrl().isEmpty()) {
            throw new AppException(502, ErrorCode.UPSTREAM_ERROR, "RIOT_API_KEY is not configured on the server");
        }
        RateLimiter limiter = limiterFor(host);

        for (int attempt = 0; ; attempt++) {
            try {
                limiter.acquire();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted", e);
            }
            HttpResponse<String> res;
            try {
                res = http.send(HttpRequest.newBuilder(urlFor(host, path, query))
                        .header("X-Riot-Token", props.riotApiKey())
                        .timeout(Duration.ofSeconds(30)).GET().build(), HttpResponse.BodyHandlers.ofString());
            } catch (IOException e) {
                if (attempt < 3) {
                    sleep(500L * (1L << attempt));
                    continue;
                }
                throw new AppException(502, ErrorCode.UPSTREAM_ERROR, "Riot API unreachable: " + e.getMessage());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted", e);
            }

            int status = res.statusCode();
            if (status / 100 == 2) {
                try {
                    return om.readTree(res.body());
                } catch (IOException e) {
                    throw new AppException(502, ErrorCode.UPSTREAM_ERROR, "Riot API returned invalid JSON");
                }
            }
            if (status == 404) throw new RiotNotFoundException(path);

            if (status == 429 && attempt < 4) {
                long retryAfter = Long.parseLong(res.headers().firstValue("retry-after").orElse("1"));
                limiter.blockFor(retryAfter * 1000 + 250);
                continue;
            }
            if (status >= 500 && attempt < 3) {
                sleep(500L * (1L << attempt));
                continue;
            }
            if (status == 401 || status == 403) {
                throw new AppException(502, ErrorCode.UPSTREAM_ERROR, "Riot rejected the API key (invalid or expired)");
            }
            throw new AppException(502, ErrorCode.UPSTREAM_ERROR, "Riot API returned " + status);
        }
    }

    private JsonNode get(String host, String path) {
        return get(host, path, Map.of());
    }

    // ---------- endpoints ----------
    public JsonNode account(String region, String gameName, String tagLine) {
        return get(Domain.ROUTING.get(region), "/riot/account/v1/accounts/by-riot-id/" + enc(gameName) + "/" + enc(tagLine));
    }

    public JsonNode summoner(String region, String puuid) {
        return get(region, "/lol/summoner/v4/summoners/by-puuid/" + enc(puuid));
    }

    /** Array of league entries. */
    public JsonNode leagueEntries(String region, String puuid) {
        return get(region, "/lol/league/v4/entries/by-puuid/" + enc(puuid));
    }

    /** Array of match ids. {@code startTime} (epoch seconds) may be null. */
    public JsonNode matchIds(String region, String puuid, int queue, int count, Long startTime) {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("queue", queue);
        q.put("count", count);
        q.put("startTime", startTime);
        return get(Domain.ROUTING.get(region), "/lol/match/v5/matches/by-puuid/" + enc(puuid) + "/ids", q);
    }

    public JsonNode match(String region, String matchId) {
        return get(Domain.ROUTING.get(region), "/lol/match/v5/matches/" + enc(matchId));
    }

    public JsonNode timeline(String region, String matchId) {
        return get(Domain.ROUTING.get(region), "/lol/match/v5/matches/" + enc(matchId) + "/timeline");
    }

    /** Players of one division (iron..diamond). Array of league entries. */
    public JsonNode divisionEntries(String region, String queueRiot, String tier, String division, int page) {
        return get(region, "/lol/league/v4/entries/" + queueRiot + "/" + tier.toUpperCase() + "/" + division,
                Map.of("page", page));
    }

    /** Players of master, grandmaster or challenger: object with an {@code entries} array. */
    public JsonNode apexEntries(String region, String queueRiot, String tier) {
        return get(region, "/lol/league/v4/" + tier + "leagues/by-queue/" + queueRiot);
    }

    /** Fallback when a league entry has no puuid. */
    public JsonNode summonerBySummonerId(String region, String summonerId) {
        return get(region, "/lol/summoner/v4/summoners/" + enc(summonerId));
    }
}
