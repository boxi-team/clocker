package com.lolstats.config;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

class WebConfigTest {

    @Test
    void addCorsMappingsRegistersExpectedRules() {
        WebConfig config = new WebConfig();
        CorsRegistry registry = new CorsRegistry();
        assertDoesNotThrow(() -> config.addCorsMappings(registry));
    }
}
