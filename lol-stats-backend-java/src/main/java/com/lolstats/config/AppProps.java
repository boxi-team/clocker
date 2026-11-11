package com.lolstats.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "lol")
public record AppProps(
        @DefaultValue("") String adminToken,
        @DefaultValue("") String riotApiKey,
        @DefaultValue("") String riotBaseUrl,
        @DefaultValue("20:1000,100:120000") String riotRateLimits,
        @DefaultValue("en_US") String locale,
        @DefaultValue("https://ddragon.leagueoflegends.com") String ddragonBase,
        @DefaultValue("true") boolean enableCron,
        @DefaultValue("true") boolean enableWorker,
        @DefaultValue("2") int workerConcurrency,
        @DefaultValue("0.25") double timelineSampleRate,
        @DefaultValue("20") int firstImportCount,
        @DefaultValue("120") int refreshCooldownSeconds,
        @DefaultValue("100") int lowSampleGames,
        @DefaultValue("120") int inboundRateLimit,
        @DefaultValue("false") boolean enableDailyCrawl,
        @DefaultValue("eun1") String dailyCrawlRegion,
        @DefaultValue("1000") int dailyMatchesPerTier,
        @DefaultValue("") String dailyMatchesOverrides) {

    public record Limit(int max, long windowMs) {}

    /** "20:1000,100:120000" -> [Limit(20,1000), Limit(100,120000)] */
    public List<Limit> limits() {
        return Arrays.stream(riotRateLimits.split(","))
                .map(String::trim)
                .map(part -> {
                    String[] s = part.split(":");
                    return new Limit(Integer.parseInt(s[0]), Long.parseLong(s[1]));
                })
                .toList();
    }

    /** Daily match target for a tier: its value from dailyMatchesOverrides if listed, else dailyMatchesPerTier. */
    public int dailyMatchesFor(String tier) {
        for (String part : dailyMatchesOverrides.split(",")) {
            String[] s = part.trim().split(":");
            if (s.length == 2 && s[0].trim().equalsIgnoreCase(tier)) return Integer.parseInt(s[1].trim());
        }
        return dailyMatchesPerTier;
    }
}