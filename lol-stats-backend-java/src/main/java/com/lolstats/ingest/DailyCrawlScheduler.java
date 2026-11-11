package com.lolstats.ingest;

import static com.lolstats.common.Api.obj;

import com.lolstats.common.Domain;
import com.lolstats.config.AppProps;
import com.lolstats.jobs.JobService;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Once a day, queues one crawl job per tier so every tier gets new matches and its win rates stay current. */
@Component
public class DailyCrawlScheduler {
    private static final Logger log = LoggerFactory.getLogger(DailyCrawlScheduler.class);
    private static final Set<String> APEX = Set.of("master", "grandmaster", "challenger");
    // Ladder pages to read per tier (about 200 players each); the crawl stops early once the target is reached.
    private static final int PAGES = 5;
    private static final int MATCHES_PER_PLAYER = 10;

    private final JobService jobs;
    private final AppProps props;

    public DailyCrawlScheduler(JobService jobs, AppProps props) {
        this.jobs = jobs;
        this.props = props;
    }

    @Scheduled(cron = "${lol.daily-crawl-cron:0 0 3 * * *}")
    public void daily() {
        if (!props.enableDailyCrawl()) return;
        for (String tier : Domain.TIER_BUCKETS) {
            jobs.enqueue("crawl",
                    obj("region", props.dailyCrawlRegion(), "queue", "ranked_solo", "tier", tier,
                            "division", APEX.contains(tier) ? null : "I",
                            "pages", PAGES, "matchesPerPlayer", MATCHES_PER_PLAYER,
                            "maxStored", props.dailyMatchesFor(tier)),
                    "daily-crawl:" + tier, 0);
        }
        log.info("daily crawl queued for {} tiers in {}", Domain.TIER_BUCKETS.size(), props.dailyCrawlRegion());
    }
}