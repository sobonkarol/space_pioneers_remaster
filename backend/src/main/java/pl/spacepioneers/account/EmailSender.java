package pl.spacepioneers.account;

/** Wysylka poczty z gry (potwierdzenie adresu, reset hasla). */
public interface EmailSender {

    void send(String to, String subject, String text);
}
