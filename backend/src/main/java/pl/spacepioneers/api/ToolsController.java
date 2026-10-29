package pl.spacepioneers.api;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.game.service.SearchService;
import pl.spacepioneers.game.service.SimulatorService;
import pl.spacepioneers.security.PlayerPrincipal;

import java.util.List;

/** Wyszukiwarka i symulator walki. */
@RestController
@RequestMapping("/api")
public class ToolsController {

    private final Game game;

    public ToolsController(Game game) {
        this.game = game;
    }

    public record SimulationRequest(SimulatorService.Side attacker, SimulatorService.Side defender, int runs) {
    }

    @GetMapping("/search")
    public List<SearchService.Hit> search(@RequestParam(defaultValue = "players") String kind, @RequestParam String q) {
        return game.search().search(kind, q);
    }

    @PostMapping("/simulator")
    public SimulatorService.Result simulate(@RequestBody SimulationRequest req) {
        return game.simulator().simulate(req.attacker(), req.defender(), req.runs());
    }

    @GetMapping("/simulator/own")
    public SimulatorService.Side own(@AuthenticationPrincipal PlayerPrincipal me) {
        return game.simulator().ownTechnology(me.playerId());
    }
}
