package com.lolstats.web;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.GlobalExceptionHandler;
import com.lolstats.config.AppProps;
import com.lolstats.data.SyncService;
import com.lolstats.jobs.JobRow;
import com.lolstats.jobs.JobService;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AdminControllerTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private AppProps props;
    private SyncService sync;
    private JobService jobs;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        props = new AppProps("secret-token", "", "", "", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);
        sync = mock(SyncService.class);
        jobs = mock(JobService.class);

        AdminController controller = new AdminController(props, sync, jobs);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void syncRejectsUnauthorizedWhenTokenMissingOrWrong() throws Exception {
        mvc.perform(post("/v1/admin/sync"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));

        mvc.perform(post("/v1/admin/sync").header("x-admin-token", "wrong-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    void syncSucceedsWithValidToken() throws Exception {
        when(sync.syncChampions(false, null)).thenReturn(new SyncService.SyncResult("14.23.1", true, 160));

        mvc.perform(post("/v1/admin/sync").header("x-admin-token", "secret-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.patch").value("14.23.1"))
                .andExpect(jsonPath("$.data.synced").value(true));
    }

    @Test
    void crawlValidatesRequiredFields() throws Exception {
        // Missing region and tier
        mvc.perform(post("/v1/admin/crawl")
                        .header("x-admin-token", "secret-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"));

        // Non-apex tier without division
        mvc.perform(post("/v1/admin/crawl")
                        .header("x-admin-token", "secret-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"region\":\"euw1\",\"tier\":\"gold\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"));
    }

    @Test
    void crawlEnqueuesJobForApexTier() throws Exception {
        JobRow job = new JobRow("job-uuid", "crawl", OM.readTree("{}"), "queued", 0, 0, null, null, Instant.now(), null);
        when(jobs.enqueue(eq("crawl"), any(), isNull(), eq(0))).thenReturn(job);

        mvc.perform(post("/v1/admin/crawl")
                        .header("x-admin-token", "secret-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"region\":\"euw1\",\"tier\":\"challenger\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.id").value("job-uuid"))
                .andExpect(jsonPath("$.data.status").value("queued"));
    }
}
