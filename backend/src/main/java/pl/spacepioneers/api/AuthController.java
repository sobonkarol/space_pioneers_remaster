package pl.spacepioneers.api;

import jakarta.servlet.http.HttpServletRequest;
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
import pl.spacepioneers.game.GameException;
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

    public AuthController(Game game, PasswordEncoder encoder, SessionService sessions, LoginThrottle throttle) {
        this.game = game;
        this.encoder = encoder;
        this.sessions = sessions;
        this.throttle = throttle;
    }

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
        game.players().touch(p.getId());
        return new AuthResponse(sessions.create(p.getId()), game.players().profile(p.getId()));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request) {
        sessions.revoke(TokenAuthenticationFilter.bearer(request));
    }
}
