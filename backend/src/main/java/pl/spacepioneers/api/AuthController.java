package pl.spacepioneers.api;

import jakarta.servlet.http.HttpServletRequest;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spacepioneers.account.AccountMails;
import pl.spacepioneers.account.AccountTokens;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.service.AdminService;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.game.service.PlayerService;
import pl.spacepioneers.security.LoginThrottle;
import pl.spacepioneers.security.SessionService;
import pl.spacepioneers.security.TokenAuthenticationFilter;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final Game game;
    private final PasswordEncoder encoder;
    private final SessionService sessions;
    private final LoginThrottle throttle;
    private final AccountMails mails;
    private final AccountTokens tokens;

    public AuthController(Game game, PasswordEncoder encoder, SessionService sessions, LoginThrottle throttle,
                          AccountMails mails, AccountTokens tokens) {
        this.game = game;
        this.encoder = encoder;
        this.sessions = sessions;
        this.throttle = throttle;
        this.mails = mails;
        this.tokens = tokens;
    }

    public record TokenRequest(@NotBlank @Size(max = 100) String token) {
    }

    public record ForgotRequest(@NotBlank @Size(max = 254) String email) {
    }

    public record ResetRequest(@NotBlank @Size(max = 100) String token, @NotBlank @Size(min = 8, max = 100) String password) {
    }

    private static final DateTimeFormatter BAN_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    public record RegisterRequest(@NotBlank @Size(max = 20) String username, @NotBlank @Size(max = 254) String email,
                                  @NotBlank @Size(min = 8, max = 100) String password) {
    }

    public record LoginRequest(@NotBlank @Size(max = 254) String login, @NotBlank @Size(max = 100) String password) {
    }

    public record AuthResponse(String token, PlayerService.Profile profile) {
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
        Player p = game.players().register(req.username(), req.email(), encoder.encode(req.password()));
        mails.sendVerification(p);
        return new AuthResponse(sessions.create(p.getId()), game.players().profile(p.getId()));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        if (throttle.isLocked(req.login())) {
            throw new GameException("login_locked", "Zbyt wiele nieudanych prób. Spróbuj ponownie za kilka minut.");
        }
        Player p = game.players().findForLogin(req.login())
                .filter(x -> encoder.matches(req.password(), x.getPasswordHash()))
                .orElse(null);
        if (p == null) {
            throttle.failure(req.login());
            throw new GameException(GameException.Kind.FORBIDDEN, "bad_credentials", "Nieprawidłowy login lub hasło.");
        }
        throttle.success(req.login());
        p = game.accounts().liftExpiredBan(p.getId());
        if (p.getBannedUntil() != null) {
            String until = p.getBannedUntil().equals(AdminService.PERMANENT) ? "na stałe" : "do " + BAN_TIME.format(p.getBannedUntil());
            throw new GameException(GameException.Kind.FORBIDDEN, "account_banned",
                    "Konto jest zablokowane " + until + ". Powód: " + p.getBanReason());
        }
        game.players().touch(p.getId());
        return new AuthResponse(sessions.create(p.getId()), game.players().profile(p.getId()));
    }

    /** Potwierdzenie adresu e-mail linkiem z wiadomosci. */
    @PostMapping("/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verify(@Valid @RequestBody TokenRequest req) {
        AccountTokens.Redeemed r = tokens.redeem(req.token(), AccountTokens.Purpose.VERIFY_EMAIL);
        game.accounts().markEmailVerified(r.playerId(), r.email());
    }

    /** Prosba o link do resetu hasla. Odpowiedz jest zawsze taka sama, aby nie zdradzac, czy adres istnieje. */
    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forgot(@Valid @RequestBody ForgotRequest req) {
        game.accounts().byEmail(req.email()).ifPresent(p -> {
            try {
                mails.sendPasswordReset(p);
            } catch (GameException ignored) {
                // limit wiadomosci na godzine - nie ujawniamy tego pytajacemu
            }
        });
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@Valid @RequestBody ResetRequest req) {
        AccountTokens.Redeemed r = tokens.redeem(req.token(), AccountTokens.Purpose.RESET_PASSWORD);
        game.players().changePasswordHash(r.playerId(), encoder.encode(req.password()));
        sessions.revokeAll(r.playerId());
        Player p = game.accounts().player(r.playerId());
        if (!p.isEmailVerified() && p.getEmail().equalsIgnoreCase(r.email())) {
            game.accounts().markEmailVerified(p.getId(), r.email()); // link z poczty potwierdza dostep do adresu
        }
        throttle.success(p.getUsername());
        throttle.success(p.getEmail());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request) {
        sessions.revoke(TokenAuthenticationFilter.bearer(request));
    }
}
