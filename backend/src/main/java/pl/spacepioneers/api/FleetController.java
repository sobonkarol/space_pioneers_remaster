package pl.spacepioneers.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.service.FleetService;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.game.service.Views;
import pl.spacepioneers.security.PlayerPrincipal;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class FleetController {

    private final Game game;

    public FleetController(Game game) {
        this.game = game;
    }

    public record EstimateRequest(long planetId, @NotNull Map<String, Long> ships, @NotBlank String target,
                                  int speedPercent) {
    }

    public record SendRequest(long planetId, @NotNull Map<String, Long> ships, @NotBlank String target,
                              @NotNull Fleet.Mission mission, int speedPercent, Resources cargo, boolean targetMoon,
                              Long unionId, Integer holdHours) {
    }

    public record UnionRequest(String name) {
    }

    public record InviteRequest(@NotBlank String username) {
    }

    public record MissileRequest(@NotBlank String target, long count, String primaryTarget) {
    }

    public record PhalanxRequest(@NotBlank String target) {
    }

    public record JumpRequest(long toMoonId, @NotNull Map<String, Long> ships) {
    }

    @GetMapping("/planets/{planetId}/fleet-dispatch")
    public FleetService.DispatchInfo dispatch(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId) {
        return game.fleets().dispatchInfo(me.playerId(), planetId);
    }

    @PostMapping("/fleets/estimate")
    public FleetService.Estimate estimate(@AuthenticationPrincipal PlayerPrincipal me,
                                          @Valid @RequestBody EstimateRequest req) {
        return game.fleets().estimate(me.playerId(), req.planetId(), req.ships(), req.target(), req.speedPercent());
    }

    @PostMapping("/fleets")
    public Views.FleetMovement send(@AuthenticationPrincipal PlayerPrincipal me, @Valid @RequestBody SendRequest req) {
        return game.fleets().send(me.playerId(), new FleetService.SendRequest(req.planetId(), req.ships(), req.target(),
                req.mission(), req.speedPercent(), req.cargo(), req.targetMoon(), req.unionId(), req.holdHours()));
    }

    @PostMapping("/fleets/{fleetId}/union")
    public FleetService.UnionView createUnion(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long fleetId,
                                              @RequestBody UnionRequest req) {
        return game.fleets().createUnion(me.playerId(), fleetId, req.name());
    }

    @GetMapping("/unions")
    public List<FleetService.UnionView> unions(@AuthenticationPrincipal PlayerPrincipal me) {
        return game.fleets().unions(me.playerId());
    }

    @PostMapping("/unions/{unionId}/invite")
    public FleetService.UnionView invite(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long unionId,
                                         @Valid @RequestBody InviteRequest req) {
        return game.fleets().invite(me.playerId(), unionId, req.username());
    }

    @PostMapping("/planets/{planetId}/missiles")
    public Views.FleetMovement missiles(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId,
                                        @Valid @RequestBody MissileRequest req) {
        return game.fleets().launchMissiles(me.playerId(), planetId, req.target(), req.count(), req.primaryTarget());
    }

    @PostMapping("/planets/{moonId}/phalanx")
    public List<Views.FleetMovement> phalanx(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long moonId,
                                             @Valid @RequestBody PhalanxRequest req) {
        return game.fleets().phalanx(me.playerId(), moonId, req.target());
    }

    @PostMapping("/planets/{moonId}/jump")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void jump(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long moonId,
                     @Valid @RequestBody JumpRequest req) {
        game.fleets().jump(me.playerId(), moonId, req.toMoonId(), req.ships());
    }

    @GetMapping("/fleets")
    public List<Views.FleetMovement> fleets(@AuthenticationPrincipal PlayerPrincipal me) {
        return game.fleets().movements(me.playerId());
    }

    @PostMapping("/fleets/{fleetId}/recall")
    public Views.FleetMovement recall(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long fleetId) {
        return game.fleets().recall(me.playerId(), fleetId);
    }
}
