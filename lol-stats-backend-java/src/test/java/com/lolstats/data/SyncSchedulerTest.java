package com.lolstats.data;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.lolstats.config.AppProps;
import org.junit.jupiter.api.Test;

class SyncSchedulerTest {

    @Test
    void hourlyDoesNothingWhenCronDisabled() {
        SyncService sync = mock(SyncService.class);
        AppProps props = new AppProps("", "", "", "", "en_US", "", false, true, 2, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);

        SyncScheduler scheduler = new SyncScheduler(sync, props);
        scheduler.hourly();
        verify(sync, never()).syncChampions(anyBoolean(), any());
    }

    @Test
    void hourlyRunsSyncWhenCronEnabled() {
        SyncService sync = mock(SyncService.class);
        when(sync.syncChampions(false, null)).thenReturn(new SyncService.SyncResult("14.23.1", true, 160));
        AppProps props = new AppProps("", "", "", "", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);

        SyncScheduler scheduler = new SyncScheduler(sync, props);
        scheduler.hourly();
        verify(sync).syncChampions(false, null);
    }

    @Test
    void hourlyCatchesException() {
        SyncService sync = mock(SyncService.class);
        when(sync.syncChampions(false, null)).thenThrow(new RuntimeException("Network down"));
        AppProps props = new AppProps("", "", "", "", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);

        SyncScheduler scheduler = new SyncScheduler(sync, props);
        assertDoesNotThrow(scheduler::hourly);
    }
}
