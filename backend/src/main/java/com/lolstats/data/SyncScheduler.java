package com.lolstats.data;

import com.lolstats.config.AppProps;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Checks Data Dragon once on boot, then hourly. One request when there is no new patch. */
@Component
public class SyncScheduler {
    private static final Logger log = LoggerFactory.getLogger(SyncScheduler.class);

    private final SyncService sync;
    private final AppProps props;

    public SyncScheduler(SyncService sync, AppProps props) {
        this.sync = sync;
        this.props = props;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onBoot() {
        if (props.enableCron()) new Thread(this::run, "sync-on-boot").start();
    }

    @Scheduled(cron = "0 0 * * * *")
    public void hourly() {
        if (props.enableCron()) run();
    }

    private void run() {
        try {
            log.info("static data sync finished: {}", sync.syncChampions(false, null));
        } catch (Exception e) {
            log.error("static data sync failed", e);
        }
    }
}
