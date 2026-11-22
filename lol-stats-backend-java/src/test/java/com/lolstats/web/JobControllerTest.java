package com.lolstats.web;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.GlobalExceptionHandler;
import com.lolstats.jobs.JobRow;
import com.lolstats.jobs.JobService;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class JobControllerTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private JobService jobs;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        jobs = mock(JobService.class);
        JobController controller = new JobController(jobs);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void rejectsInvalidUuidFormat() throws Exception {
        mvc.perform(get("/v1/jobs/not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"));
    }

    @Test
    void returns404WhenJobNotFound() throws Exception {
        String uuid = "e87494f4-52d8-4f8e-9080-d667c30d979b";
        when(jobs.getJob(uuid)).thenReturn(null);

        mvc.perform(get("/v1/jobs/" + uuid))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("JOB_NOT_FOUND"));
    }

    @Test
    void returnsJobDataWhenFound() throws Exception {
        String uuid = "e87494f4-52d8-4f8e-9080-d667c30d979b";
        JobRow row = new JobRow(uuid, "player", OM.readTree("{}"), "succeeded", 20, 20, null, null, Instant.now(), Instant.now());
        when(jobs.getJob(uuid)).thenReturn(row);

        mvc.perform(get("/v1/jobs/" + uuid))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(uuid))
                .andExpect(jsonPath("$.data.status").value("succeeded"));
    }
}
