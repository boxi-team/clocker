package gg.boxi.common;

import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Uniform `{ "error": { code, message, details? } }` for every failure. */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static ResponseEntity<Map<String, Object>> body(int status, ErrorCode code, String message, Object details,
                                                            Integer retryAfter) {
        Map<String, Object> err = new LinkedHashMap<>();
        err.put("code", code.name());
        err.put("message", message);
        if (details != null) err.put("details", details);
        HttpHeaders headers = new HttpHeaders();
        if (retryAfter != null) headers.set("Retry-After", String.valueOf(retryAfter));
        return ResponseEntity.status(status).headers(headers).body(Map.of("error", err));
    }

    @ExceptionHandler(AppException.class)
    ResponseEntity<Map<String, Object>> app(AppException e) {
        return body(e.status(), e.code(), e.getMessage(), e.details(), e.retryAfter());
    }

    @ExceptionHandler({NoHandlerFoundException.class, NoResourceFoundException.class})
    ResponseEntity<Map<String, Object>> notFound(Exception e) {
        return body(404, ErrorCode.NOT_FOUND, "Route not found", null, null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<Map<String, Object>> method(HttpRequestMethodNotSupportedException e) {
        return body(404, ErrorCode.NOT_FOUND, "Route not found", null, null);
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class,
            HttpMessageNotReadableException.class})
    ResponseEntity<Map<String, Object>> badRequest(Exception e) {
        return body(400, ErrorCode.INVALID_PARAMETER, "Invalid request parameters", null, null);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> other(Exception e) {
        log.error("Unhandled error", e);
        return body(500, ErrorCode.INTERNAL, "Internal server error", null, null);
    }
}
