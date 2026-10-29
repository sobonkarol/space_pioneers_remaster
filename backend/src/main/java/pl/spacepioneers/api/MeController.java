package pl.spacepioneers.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.game.service.PlayerService;
import pl.spacepioneers.security.PlayerPrincipal;
import pl.spacepioneers.security.SessionService;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final Game game;
    private final PasswordEncoder encoder;
    private final SessionService sessions;

    public MeController(Game game, PasswordEncoder encoder, SessionService sessions) {
        this.game = game;
        this.encoder = encoder;
        this.sessions = sessions;
    }

    public record BranchRequest(@NotNull Branch branch) {
    }

    public record VacationRequest(boolean enabled) {
    }

    public record LanguageRequest(@NotBlank String language) {
    }

    public record PasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min = 8, max = 100) String newPassword) {
    }

    @GetMapping
    public PlayerService.Profile me(@AuthenticationPrincipal PlayerPrincipal me) {
        game.players().touch(me.playerId());
        return game.players().profile(me.playerId());
    }

    @PostMapping("/branch")
    public PlayerService.Profile branch(@AuthenticationPrincipal PlayerPrincipal me, @Valid @RequestBody BranchRequest req) {
        return game.players().chooseBranch(me.playerId(), req.branch());
    }

    @PostMapping("/vacation")
    public PlayerService.Profile vacation(@AuthenticationPrincipal PlayerPrincipal me, @RequestBody VacationRequest req) {
        return req.enabled() ? game.players().enableVacation(me.playerId()) : game.players().disableVacation(me.playerId());
    }

    @PostMapping("/language")
    public PlayerService.Profile language(@AuthenticationPrincipal PlayerPrincipal me, @Valid @RequestBody LanguageRequest req) {
        return game.players().setLanguage(me.playerId(), req.language());
    }

    @PostMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void password(@AuthenticationPrincipal PlayerPrincipal me, @Valid @RequestBody PasswordRequest req) {
        Player p = game.players().findForLogin(game.players().profile(me.playerId()).username()).orElseThrow();
        if (!encoder.matches(req.currentPassword(), p.getPasswordHash())) {
            throw new GameException(GameException.Kind.FORBIDDEN, "bad_credentials", "Obecne hasło jest nieprawidłowe.");
        }
        game.players().changePasswordHash(me.playerId(), encoder.encode(req.newPassword()));
        sessions.revokeAll(me.playerId());
    }
}
