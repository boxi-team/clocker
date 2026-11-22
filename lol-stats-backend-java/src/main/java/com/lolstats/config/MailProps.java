package com.lolstats.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** SMTP settings for verification emails (lol.mail.* in application.yml, MAIL_* in .env). */
@ConfigurationProperties(prefix = "lol.mail")
public record MailProps(
        @DefaultValue("") String host,
        @DefaultValue("587") int port,
        @DefaultValue("") String user,
        @DefaultValue("") String password,
        @DefaultValue("") String from) {}