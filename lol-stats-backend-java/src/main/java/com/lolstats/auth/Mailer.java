package com.lolstats.auth;

import com.lolstats.common.AppException;
import com.lolstats.common.ErrorCode;
import com.lolstats.config.MailProps;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

/** Sends plain-text emails over SMTP. Without MAIL_HOST it only logs the email, so local development needs no SMTP. */
@Component
public class Mailer {
    private static final Logger log = LoggerFactory.getLogger(Mailer.class);

    private final MailProps props;
    private final JavaMailSenderImpl sender;

    public Mailer(MailProps props) {
        this.props = props;
        if (props.host().isBlank()) {
            this.sender = null;
            return;
        }
        JavaMailSenderImpl s = new JavaMailSenderImpl();
        s.setHost(props.host());
        s.setPort(props.port());
        s.setUsername(props.user());
        s.setPassword(props.password());
        Properties p = s.getJavaMailProperties();
        p.put("mail.smtp.auth", "true");
        // 465 is SMTP over SSL; any other port (usually 587) upgrades with STARTTLS.
        if (props.port() == 465) p.put("mail.smtp.ssl.enable", "true");
        else p.put("mail.smtp.starttls.enable", "true");
        this.sender = s;
    }

    public void send(String to, String subject, String text) {
        if (sender == null) {
            log.warn("MAIL_HOST is not set, email not sent. To: {} | {} | {}", to, subject, text);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(props.from().isBlank() ? props.user() : props.from());
        msg.setTo(to);
        msg.setSubject(subject);
        msg.setText(text);
        try {
            sender.send(msg);
        } catch (MailException e) {
            log.error("could not send email to {}", to, e);
            throw new AppException(502, ErrorCode.UPSTREAM_ERROR, "Could not send the email. Please try again later.");
        }
    }
}