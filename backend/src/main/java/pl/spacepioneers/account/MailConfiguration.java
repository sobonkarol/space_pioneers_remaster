package pl.spacepioneers.account;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

/** Wybor sposobu wysylki: SMTP, gdy ustawiono spring.mail.host (MAIL_HOST), w przeciwnym razie dziennik serwera. */
@Configuration
public class MailConfiguration {

    @Bean
    public EmailSender emailSender(ObjectProvider<JavaMailSender> smtp,
                                   @Value("${spacepioneers.mail.from:no-reply@spacepioneers.local}") String from,
                                   @Value("${spacepioneers.mail.dev-outbox:false}") boolean devOutbox) {
        JavaMailSender sender = smtp.getIfAvailable();
        return sender != null ? new SmtpEmailSender(sender, from) : new LogEmailSender(devOutbox);
    }
}
