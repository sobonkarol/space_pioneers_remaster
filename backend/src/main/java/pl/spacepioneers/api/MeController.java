package pl.spacepioneers.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spacepioneers.account.AccountMails;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.game.service.PlayerService;
import pl.spacepioneers.security.PlayerPrincipal;
import pl.spacepioneers.security.SessionService;

import java.time.Instant;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final Game game;
    private final PasswordEncoder encoder;
    private final SessionService sessions;
    private final AccountMails mails;

    public MeController(Game game, PasswordEncoder encoder, SessionService sessions, AccountMails mails) {
        this.game = game;
        this.encoder = encoder;
        this.sessions = sessions;
        this.mails = mails;
    }

    public record EmailRequest(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 100) String password) {
    }

    public record ConfirmRequest(@NotBlank @Size(max = 100) String password) {
    }

    public record DeletionResponse(Instant deletionAt) {
    }

    private void requirePassword(long playerId, String password) {
        Player p = game.accounts().player(playerId);
        if (!encoder.matches(password, p.getPasswordHash())) {
            throw new GameException(GameException.Kind.FORBIDDEN, "bad_credentials", "Hasło jest nieprawidłowe.");
        }
    }

    /** Ponowne wyslanie linku potwierdzajacego adres e-mail. */
    @PostMapping("/verification")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendVerification(@AuthenticationPrincipal PlayerPrincipal me) {
        Player p = game.accounts().player(me.playerId());
        if (p.isEmailVerified()) {
            throw new GameException("already_verified", "Adres e-mail jest już potwierdzony.");
        }
        mails.sendVerification(p);
    }

    @PostMapping("/email")
    public PlayerService.Profile changeEmail(@AuthenticationPrincipal PlayerPrincipal me, @Valid @RequestBody EmailRequest req) {
        requirePassword(me.playerId(), req.password());
        Player p = game.accounts().changeEmail(me.playerId(), req.email());
        mails.sendVerification(p);
        return game.players().profile(me.playerId());
    }

    /** Zaplanowanie usuniecia konta (po 7 dniach; do tego czasu mozna anulowac). */
    @PostMapping("/deletion")
    public DeletionResponse requestDeletion(@AuthenticationPrincipal PlayerPrincipal me, @Valid @RequestBody ConfirmRequest req) {
        requirePassword(me.playerId(), req.password());
        return new DeletionResponse(game.accounts().requestDeletion(me.playerId()));
    }

    @DeleteMapping("/deletion")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelDeletion(@AuthenticationPrincipal PlayerPrincipal me) {
        game.accounts().cancelDeletion(me.playerId());
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
        Player p = game.accounts().player(me.playerId());
        if (!encoder.matches(req.currentPassword(), p.getPasswordHash())) {
            throw new GameException(GameException.Kind.FORBIDDEN, "bad_credentials", "Obecne hasło jest nieprawidłowe.");
        }
        game.players().changePasswordHash(me.playerId(), encoder.encode(req.newPassword()));
        sessions.revokeAll(me.playerId());
    }
}
