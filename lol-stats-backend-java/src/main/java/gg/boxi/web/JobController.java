package gg.boxi.web;

import static gg.boxi.common.Api.obj;

import gg.boxi.common.AppException;
import gg.boxi.common.ErrorCode;
import gg.boxi.common.Q;
import gg.boxi.jobs.JobRow;
import gg.boxi.jobs.JobService;
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
