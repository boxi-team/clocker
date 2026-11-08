package com.lolstats.web;

import static com.lolstats.common.Api.obj;

import com.lolstats.common.AppException;
import com.lolstats.common.ErrorCode;
import com.lolstats.common.Q;
import com.lolstats.jobs.JobRow;
import com.lolstats.jobs.JobService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
public class JobController {
    private static final String UUID_RE = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    private final JobService jobs;

    public JobController(JobService jobs) {
        this.jobs = jobs;
    }

    @GetMapping("/jobs/{jobId}")
    public Object job(@PathVariable String jobId) {
        String id = new Q(Map.of("jobId", jobId)).regex("jobId", UUID_RE, null);
        JobRow job = jobs.getJob(id);
        if (job == null) throw AppException.notFound(ErrorCode.JOB_NOT_FOUND, "Job not found");
        return obj("data", job.toApi());
    }
}
