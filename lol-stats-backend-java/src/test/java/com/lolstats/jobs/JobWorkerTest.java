package com.lolstats.jobs;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.config.AppProps;
import com.lolstats.ingest.CrawlService;
import com.lolstats.ingest.LeaderboardService;
import com.lolstats.ingest.PlayerService;
import org.junit.jupiter.api.Test;

class JobWorkerTest {
    private final ObjectMapper om = new ObjectMapper();

    @Test
    void workerDoesNotStartWhenDisabled() {
        JobService jobs = mock(JobService.class);
        PlayerService players = mock(PlayerService.class);
        CrawlService crawl = mock(CrawlService.class);
        LeaderboardService leaderboard = mock(LeaderboardService.class);
        AppProps props = new AppProps("", "", "", "", "en_US", "", true, false, 1, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);

        JobWorker worker = new JobWorker(jobs, players, crawl, leaderboard, props, om);
        worker.start();
        assertFalse(worker.isRunning());
        verify(jobs, never()).failInterrupted();
        worker.stop();
    }

    @Test
    void workerStartsAndStopsWhenEnabled() {
        JobService jobs = mock(JobService.class);
        PlayerService players = mock(PlayerService.class);
        CrawlService crawl = mock(CrawlService.class);
        LeaderboardService leaderboard = mock(LeaderboardService.class);
        AppProps props = new AppProps("", "", "", "", "en_US", "", true, true, 1, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);

        JobWorker worker = new JobWorker(jobs, players, crawl, leaderboard, props, om);
        worker.start();
        assertTrue(worker.isRunning());
        verify(jobs).failInterrupted();

        worker.stop();
        assertFalse(worker.isRunning());
    }
}
