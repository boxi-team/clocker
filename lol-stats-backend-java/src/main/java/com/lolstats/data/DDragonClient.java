package com.lolstats.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.config.AppProps;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/** Data Dragon (static game data) client and URL builders. */
@Component
public class DDragonClient {
    private final AppProps props;
    private final ObjectMapper om;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public DDragonClient(AppProps props, ObjectMapper om) {
        this.props = props;
        this.om = om;
    }

    private JsonNode getJson(String url) {
        Exception last = null;
        for (int i = 1; i <= 3; i++) {
            try {
                HttpResponse<String> res = http.send(
                        HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30)).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() / 100 != 2) throw new IllegalStateException("HTTP " + res.statusCode() + " for " + url);
                return om.readTree(res.body());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted", e);
            } catch (Exception e) {
                last = e;
                try {
                    Thread.sleep(500L * i);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        throw new IllegalStateException("Data Dragon request failed: " + url, last);
    }

    public String fetchLatestVersion() {
        return getJson(props.ddragonBase() + "/api/versions.json").get(0).asText();
    }

    /** Champion ids ("Ahri", "MonkeyKing", ...) of a patch. */
    public List<String> fetchChampionIds(String version) {
        JsonNode data = getJson(props.ddragonBase() + "/cdn/" + version + "/data/" + props.locale() + "/champion.json").path("data");
        List<String> ids = new ArrayList<>();
        data.fieldNames().forEachRemaining(ids::add);
        // The map key is the id; fall back to the "id" field if they ever differ.
        return ids.stream().map(k -> data.path(k).path("id").asText(k)).toList();
    }

    public JsonNode fetchChampionDetail(String version, String id) {
        return getJson(props.ddragonBase() + "/cdn/" + version + "/data/" + props.locale() + "/champion/" + id + ".json")
                .path("data").path(id);
    }

    public JsonNode fetchItems(String version) {
        return getJson(props.ddragonBase() + "/cdn/" + version + "/data/" + props.locale() + "/item.json");
    }

    public JsonNode fetchRunes(String version) {
        return getJson(props.ddragonBase() + "/cdn/" + version + "/data/" + props.locale() + "/runesReforged.json");
    }

    public JsonNode fetchSummonerSpells(String version) {
        return getJson(props.ddragonBase() + "/cdn/" + version + "/data/" + props.locale() + "/summoner.json");
    }

    public String profileIconUrl(String version, int iconId) {
        return props.ddragonBase() + "/cdn/" + version + "/img/profileicon/" + iconId + ".png";
    }

    public String championImageUrl(String version, String imageFile) {
        return props.ddragonBase() + "/cdn/" + version + "/img/champion/" + imageFile;
    }

    public String splashUrl(String id) {
        return props.ddragonBase() + "/cdn/img/champion/splash/" + id + "_0.jpg";
    }
}
