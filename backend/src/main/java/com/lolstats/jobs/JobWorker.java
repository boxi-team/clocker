package com.lolstats.jobs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.config.AppProps;
import com.lolstats.ingest.CrawlService;
import com.lolstats.ingest.CrawlService.CrawlPayload;
import com.lolstats.ingest.PlayerRow;
import com.lolstats.ingest.PlayerService;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

/** Polls the jobs table and runs queued jobs on a small thread pool. */
@Component
public class JobWorker implements SmartLifecycle {
    private static final Logger log = LoggerFactory.getLogger(JobWorker.class);

    private final JobService jobs;
    private final PlayerService players;
    private final CrawlService crawl;
    private final AppProps props;
    private final ObjectMapper om;
    private final List<Thread> threads = new ArrayList<>();
    private volatile boolean running;

    public JobWorker(JobService jobs, PlayerService players, CrawlService crawl, AppProps props, ObjectMapper om) {
        this.jobs = jobs;
        this.players = players;
        this.crawl = crawl;
        this.props = props;
        this.om = om;
    }

    @Override
    public void start() {
        if (!props.enableWorker()) return;
        jobs.failInterrupted();
        running = true;
        for (int i = 0; i < props.workerConcurrency(); i++) {
            Thread t = new Thread(this::loop, "job-worker-" + i);
            t.start();
            threads.add(t);
        }
    }

    @Override
    public void stop() {
        running = false;
        threads.forEach(Thread::interrupt);
        for (Thread t : threads) {
            try {
                t.join(5000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        threads.clear();
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    private void loop() {
        while (running) {
            try {
                JobRow job = jobs.claim();
                if (job != null) work(job);
                else Thread.sleep(1000);
            } catch (InterruptedException e) {
                return;
            } catch (Exception e) {
                log.error("job worker error", e);
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ie) {
                    return;
                }
            }
        }
    }

    private void work(JobRow job) {
        Progress progress = (done, total) -> jobs.progress(job.id(), done, total);
        try {
            jobs.succeed(job.id(), run(job, progress));
        } catch (Exception e) {
            log.error("job {} ({}) failed", job.id(), job.type(), e);
            jobs.fail(job.id(), e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        }
    }

    private Object run(JobRow job, Progress progress) throws Exception {
        switch (job.type()) {
            case "player_refresh": {
                String puuid = job.payload().path("puuid").asText();
                boolean skipProfile = job.payload().path("skipProfile").asBoolean(false);
                PlayerRow player = players.getPlayerByPuuid(puuid);
                if (player == null) throw new IllegalStateException("player vanished");
                // Re-read name, level and ranks from Riot (skipped right after the profile was just fetched).
                if (!skipProfile) players.fetchAndStorePlayer(player.region(), player.gameName(), player.tagLine());
                return players.importPlayerMatches(puuid, progress);
            }
            case "crawl":
                return crawl.crawlLadder(om.treeToValue(job.payload(), CrawlPayload.class), progress);
            default:
                throw new IllegalStateException("unknown job type " + job.type());
        }
    }
}
