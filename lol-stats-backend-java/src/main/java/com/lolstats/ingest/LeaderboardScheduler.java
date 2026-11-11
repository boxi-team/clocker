package com.lolstats.ingest;

import static com.lolstats.common.Api.obj;

import com.lolstats.common.Domain;
import com.lolstats.config.AppProps;
import com.lolstats.jobs.JobService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** On boot and then every 30 minutes, queues one leaderboard refresh job per configured region. */
@Component
public class LeaderboardScheduler {
    private static final Logger log = LoggerFactory.getLogger(LeaderboardScheduler.class);

    private final JobService jobs;
    private final AppProps props;

    public LeaderboardScheduler(JobService jobs, AppProps props) {
        this.jobs = jobs;
        this.props = props;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onBoot() {
        refresh();
    }

    @Scheduled(cron = "${lol.leaderboard-cron:0 */30 * * * *}")
    public void refresh() {
        if (!props.enableLeaderboard()) return;
        for (String region : props.leaderboardRegionList()) {
            if (!Domain.REGIONS.contains(region)) {
                log.warn("leaderboard: unknown region {} skipped", region);
                continue;
            }
            // Higher priority than the daily crawl (0), lower than player refreshes (10).
            jobs.enqueue("leaderboard", obj("region", region), "leaderboard:" + region, 5);
        }
        log.info("leaderboard refresh queued for {}", props.leaderboardRegionList());
    }
}