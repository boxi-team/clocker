package gg.boxi.common;

import java.util.List;
import java.util.Map;

public class AppException extends RuntimeException {
    private final int status;
    private final ErrorCode code;
    private final transient Object details;
    private final Integer retryAfter;

    public AppException(int status, ErrorCode code, String message) {
        this(status, code, message, null, null);
    }

    public AppException(int status, ErrorCode code, String message, Object details, Integer retryAfter) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.retryAfter = retryAfter;
    }

    public int status() { return status; }
    public ErrorCode code() { return code; }
    public Object details() { return details; }
    public Integer retryAfter() { return retryAfter; }

    public static AppException notFound(ErrorCode code, String message) {
        return new AppException(404, code, message);
    }

    public static AppException dataNotReady() {
        return new AppException(503, ErrorCode.DATA_NOT_READY, "No data synced yet. Run POST /v1/admin/sync first.");
    }

    public static AppException invalid(String path, String message) {
        return new AppException(400, ErrorCode.INVALID_PARAMETER, "Invalid request parameters",
                List.of(Map.of("path", path, "message", message)), null);
    }

    public static AppException invalidMessage(String message) {
        return new AppException(400, ErrorCode.INVALID_PARAMETER, message);
    }
}
