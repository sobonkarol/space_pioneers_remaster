package pl.spacepioneers.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spacepioneers.engine.data.UnitDef;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.game.service.Views;
import pl.spacepioneers.security.PlayerPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api")
public class PlanetController {

    private final Game game;

    public PlanetController(Game game) {
        this.game = game;
    }

    public record ProductionRequest(@NotBlank String source, @Min(0) @Max(100) int percent) {
    }

    public record RenameRequest(@NotBlank String name) {
    }

    public record ShipyardRequest(@NotBlank String unit, @Min(1) long count) {
    }

    @GetMapping("/planets")
    public List<Views.PlanetRef> planets(@AuthenticationPrincipal PlayerPrincipal me) {
        return game.planets().planets(me.playerId());
    }

    @GetMapping("/empire")
    public List<Views.EmpirePlanet> empire(@AuthenticationPrincipal PlayerPrincipal me) {
        return game.planets().empire(me.playerId());
    }

    @GetMapping("/planets/{planetId}/overview")
    public Views.Overview overview(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId) {
        game.players().touch(me.playerId());
        return game.planets().overview(me.playerId(), planetId);
    }

    @GetMapping("/planets/{planetId}/buildings")
    public List<Views.UpgradeOption> buildings(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId) {
        return game.planets().buildings(me.playerId(), planetId);
    }

    @PostMapping("/planets/{planetId}/buildings/{key}")
    public Views.BuildQueueItem build(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId,
                                      @PathVariable String key) {
        return game.planets().enqueue(me.playerId(), planetId, key);
    }

    @PostMapping("/planets/{planetId}/buildings/{key}/demolish")
    public Views.BuildQueueItem demolish(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId,
                                         @PathVariable String key) {
        return game.planets().demolish(me.playerId(), planetId, key);
    }

    @DeleteMapping("/planets/{planetId}/build-queue/{orderId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelBuild(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId,
                            @PathVariable long orderId) {
        game.planets().cancelBuild(me.playerId(), planetId, orderId);
    }

    @GetMapping("/planets/{planetId}/resources")
    public Views.ResourcesView resources(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId) {
        return game.planets().resources(me.playerId(), planetId);
    }

    @PutMapping("/planets/{planetId}/production")
    public Views.ResourcesView production(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId,
                                          @Valid @RequestBody ProductionRequest req) {
        game.planets().setProduction(me.playerId(), planetId, req.source(), req.percent());
        return game.planets().resources(me.playerId(), planetId);
    }

    @PutMapping("/planets/{planetId}/name")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rename(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId,
                       @Valid @RequestBody RenameRequest req) {
        game.planets().rename(me.playerId(), planetId, req.name());
    }

    @DeleteMapping("/planets/{planetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void abandon(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId) {
        game.planets().abandon(me.playerId(), planetId);
    }

    // --- badania

    @GetMapping("/planets/{planetId}/research")
    public List<Views.UpgradeOption> research(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId) {
        return game.research().list(me.playerId(), planetId);
    }

    @PostMapping("/planets/{planetId}/research/{key}")
    public Views.ResearchInProgress startResearch(@AuthenticationPrincipal PlayerPrincipal me,
                                                  @PathVariable long planetId, @PathVariable String key) {
        return game.research().start(me.playerId(), planetId, key);
    }

    @DeleteMapping("/research")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelResearch(@AuthenticationPrincipal PlayerPrincipal me) {
        game.research().cancel(me.playerId());
    }

    // --- stocznia i obrona

    @GetMapping("/planets/{planetId}/shipyard")
    public List<Views.UnitOption> shipyard(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId,
                                           @RequestParam(defaultValue = "SHIP") UnitDef.UnitType type) {
        return game.shipyard().list(me.playerId(), planetId, type);
    }

    @PostMapping("/planets/{planetId}/shipyard")
    public Views.ShipyardItem order(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId,
                                    @Valid @RequestBody ShipyardRequest req) {
        return game.shipyard().order(me.playerId(), planetId, req.unit(), req.count());
    }
}
