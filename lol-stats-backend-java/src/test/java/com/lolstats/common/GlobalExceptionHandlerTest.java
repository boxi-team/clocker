package com.lolstats.common;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handlesAppException() {
        AppException ex = new AppException(404, ErrorCode.CHAMPION_NOT_FOUND, "Ahri not found");
        ResponseEntity<Map<String, Object>> response = handler.app(ex);

        assertEquals(404, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> err = (Map<String, Object>) response.getBody().get("error");
        assertEquals("CHAMPION_NOT_FOUND", err.get("code"));
        assertEquals("Ahri not found", err.get("message"));
    }

    @Test
    void handlesAppExceptionWithRetryAfter() {
        AppException ex = new AppException(429, ErrorCode.RATE_LIMITED, "Wait", null, 60);
        ResponseEntity<Map<String, Object>> response = handler.app(ex);

        assertEquals(429, response.getStatusCode().value());
        assertEquals("60", response.getHeaders().getFirst("Retry-After"));
    }

    @Test
    void handlesNoResourceFoundException() {
        NoResourceFoundException ex = mock(NoResourceFoundException.class);
        ResponseEntity<Map<String, Object>> response = handler.notFound(ex);

        assertEquals(404, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> err = (Map<String, Object>) response.getBody().get("error");
        assertEquals("NOT_FOUND", err.get("code"));
        assertEquals("Route not found", err.get("message"));
    }

    @Test
    void handlesHttpRequestMethodNotSupportedException() {
        HttpRequestMethodNotSupportedException ex = new HttpRequestMethodNotSupportedException("POST");
        ResponseEntity<Map<String, Object>> response = handler.method(ex);

        assertEquals(404, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> err = (Map<String, Object>) response.getBody().get("error");
        assertEquals("NOT_FOUND", err.get("code"));
    }

    @Test
    void handlesBadRequestExceptions() {
        MissingServletRequestParameterException ex = new MissingServletRequestParameterException("region", "String");
        ResponseEntity<Map<String, Object>> response = handler.badRequest(ex);

        assertEquals(400, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> err = (Map<String, Object>) response.getBody().get("error");
        assertEquals("INVALID_PARAMETER", err.get("code"));
        assertEquals("Invalid request parameters", err.get("message"));
    }

    @Test
    void handlesGenericException() {
        RuntimeException ex = new RuntimeException("Unexpected boom");
        ResponseEntity<Map<String, Object>> response = handler.other(ex);

        assertEquals(500, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> err = (Map<String, Object>) response.getBody().get("error");
        assertEquals("INTERNAL", err.get("code"));
        assertEquals("Internal server error", err.get("message"));
    }

    private static <T> T mock(Class<T> clazz) {
        return org.mockito.Mockito.mock(clazz);
    }
}
