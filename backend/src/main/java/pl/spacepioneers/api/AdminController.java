package pl.spacepioneers.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spacepioneers.account.AdminLog;
import pl.spacepioneers.game.service.AdminService;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.security.PlayerPrincipal;
import pl.spacepioneers.security.SessionService;

import java.util.List;
import java.util.Map;

/** Panel administratora. Kazda operacja sprawdza uprawnienia w logice gry i trafia do dziennika. */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final Game game;
    private final SessionService sessions;
    private final AdminLog log;

    public AdminController(Game game, SessionService sessions, AdminLog log) {
        this.game = game;
        this.sessions = sessions;
        this.log = log;
    }

    public record BanRequest(Integer hours, @NotBlank String reason) {
    }

    public record AdminFlagRequest(boolean admin) {
    }

    public record AnnounceRequest(@NotBlank String subject, @NotBlank String body) {
    }

    private String adminName(PlayerPrincipal me) {
        return game.accounts().player(me.playerId()).getUsername();
    }

    @GetMapping("/stats")
    public AdminService.ServerStats stats(@AuthenticationPrincipal PlayerPrincipal me) {
        return game.admin().stats(me.playerId());
    }

    @GetMapping("/players")
    public List<AdminService.PlayerRow> players(@AuthenticationPrincipal PlayerPrincipal me,
                                                @RequestParam(defaultValue = "") String q) {
        return game.admin().search(me.playerId(), q);
    }

    @GetMapping("/players/{id}")
    public AdminService.PlayerDetail player(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        return game.admin().detail(me.playerId(), id);
    }

    @PostMapping("/players/{id}/ban")
    public AdminService.PlayerRow ban(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id,
                                      @Valid @RequestBody BanRequest req) {
        AdminService.PlayerRow row = game.admin().ban(me.playerId(), id, req.hours(), req.reason());
        sessions.revokeAll(id);
        log.add(adminName(me), "BAN", id, row.username(), req.reason().trim(), row.bannedUntil());
        return row;
    }

    @PostMapping("/players/{id}/unban")
    public AdminService.PlayerRow unban(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        AdminService.PlayerRow row = game.admin().unban(me.playerId(), id);
        log.add(adminName(me), "UNBAN", id, row.username(), null, null);
        return row;
    }

    @PostMapping("/players/{id}/admin")
    public AdminService.PlayerRow setAdmin(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id,
                                           @RequestBody AdminFlagRequest req) {
        AdminService.PlayerRow row = game.admin().setAdmin(me.playerId(), id, req.admin());
        log.add(adminName(me), req.admin() ? "GRANT_ADMIN" : "REVOKE_ADMIN", id, row.username(), null, null);
        return row;
    }

    @PostMapping("/players/{id}/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        String name = game.admin().deleteNow(me.playerId(), id);
        log.add(adminName(me), "DELETE", id, name, null, null);
    }

    @PostMapping("/announce")
    public Map<String, Integer> announce(@AuthenticationPrincipal PlayerPrincipal me, @Valid @RequestBody AnnounceRequest req) {
        int n = game.admin().announce(me.playerId(), req.subject(), req.body());
        log.add(adminName(me), "ANNOUNCE", null, null, req.subject().trim(), null);
        return Map.of("recipients", n);
    }

    @GetMapping("/log")
    public List<AdminLog.Entry> log(@AuthenticationPrincipal PlayerPrincipal me) {
        game.admin().stats(me.playerId()); // sprawdzenie uprawnien
        return log.recent(200);
    }
}
