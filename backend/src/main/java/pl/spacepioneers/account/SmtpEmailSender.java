package pl.spacepioneers.account;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

/** Wysylka przez serwer SMTP skonfigurowany zmiennymi MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD. */
public class SmtpEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailSender.class);

    private final JavaMailSender mail;
    private final String from;

    public SmtpEmailSender(JavaMailSender mail, String from) {
        this.mail = mail;
        this.from = from;
    }

    @Override
    public void send(String to, String subject, String text) {
        SimpleMailMessage m = new SimpleMailMessage();
        m.setFrom(from);
        m.setTo(to);
        m.setSubject(subject);
        m.setText(text);
        try {
            mail.send(m);
        } catch (MailException e) {
            // blad poczty nie moze zablokowac rejestracji - gracz wysle link ponownie z ustawien
            log.error("Nie udalo sie wyslac e-maila do {}: {}", to, e.getMessage());
        }
    }
}
