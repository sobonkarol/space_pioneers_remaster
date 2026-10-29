package pl.spacepioneers.account;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import pl.spacepioneers.game.model.Player;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** Tresc wiadomosci e-mail o koncie (w jezyku gracza: polski albo angielski). */
@Service
public class AccountMails {

    private final EmailSender sender;
    private final AccountTokens tokens;
    private final String publicUrl;

    public AccountMails(EmailSender sender, AccountTokens tokens,
                        @Value("${spacepioneers.public-url:http://localhost:8080}") String publicUrl) {
        this.sender = sender;
        this.tokens = tokens;
        this.publicUrl = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
    }

    private String link(String path, String token) {
        return publicUrl + path + "?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
    }

    public void sendVerification(Player p) {
        String token = tokens.issue(p.getId(), p.getEmail(), AccountTokens.Purpose.VERIFY_EMAIL);
        String url = link("/verify", token);
        if ("pl".equals(p.getLanguage())) {
            sender.send(p.getEmail(), "Space Pioneers - potwierdź adres e-mail",
                    "Witaj " + p.getUsername() + "!\n\nPotwierdź adres e-mail swojego konta, otwierając link:\n" + url
                            + "\n\nLink jest ważny 3 dni. Jeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość.");
        } else {
            sender.send(p.getEmail(), "Space Pioneers - confirm your e-mail address",
                    "Hello " + p.getUsername() + "!\n\nConfirm the e-mail address of your account by opening:\n" + url
                            + "\n\nThe link is valid for 3 days. If you did not create this account, ignore this message.");
        }
    }

    public void sendPasswordReset(Player p) {
        String token = tokens.issue(p.getId(), p.getEmail(), AccountTokens.Purpose.RESET_PASSWORD);
        String url = link("/reset-password", token);
        if ("pl".equals(p.getLanguage())) {
            sender.send(p.getEmail(), "Space Pioneers - ustawienie nowego hasła",
                    "Witaj " + p.getUsername() + "!\n\nAby ustawić nowe hasło, otwórz link:\n" + url
                            + "\n\nLink jest ważny 1 godzinę. Jeśli nie prosiłeś o zmianę hasła, zignoruj tę wiadomość - "
                            + "obecne hasło pozostaje bez zmian.");
        } else {
            sender.send(p.getEmail(), "Space Pioneers - set a new password",
                    "Hello " + p.getUsername() + "!\n\nTo set a new password, open:\n" + url
                            + "\n\nThe link is valid for 1 hour. If you did not ask for a new password, ignore this message.");
        }
    }
}
