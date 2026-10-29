package pl.spacepioneers.api;

import com.fasterxml.jackson.annotation.JsonRawValue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
import pl.spacepioneers.engine.common.ResourceType;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Treaty;
import pl.spacepioneers.game.service.AllianceService;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.game.service.MarketService;
import pl.spacepioneers.game.service.Views;
import pl.spacepioneers.security.PlayerPrincipal;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Galaktyka, wiadomosci, sojusze, ranking, rynek. */
@RestController
@RequestMapping("/api")
public class SocialController {

    private final Game game;

    public SocialController(Game game) {
        this.game = game;
    }

    // --- galaktyka

    @GetMapping("/galaxy/{galaxy}/{system}")
    public Views.GalaxyView galaxy(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable int galaxy,
                                   @PathVariable int system) {
        return game.galaxy().system(me.playerId(), galaxy, system);
    }

    // --- wiadomosci

    /** Wiadomosc z raportem przekazanym jako zagniezdzony obiekt JSON. */
    public record MessageDto(long id, Long senderId, String senderName, String type, String subject, String body,
                             @JsonRawValue String payload, Instant createdAt, boolean read) {
        static MessageDto of(Message m) {
            return new MessageDto(m.id(), m.senderId(), m.senderName(), m.type().name(), m.subject(), m.body(),
                    m.payload(), m.createdAt(), m.read());
        }
    }

    public record SendMessageRequest(@NotBlank String to, String subject, @NotBlank String body) {
    }

    @GetMapping("/messages")
    public List<MessageDto> messages(@AuthenticationPrincipal PlayerPrincipal me,
                                     @RequestParam(required = false) Message.Type type,
                                     @RequestParam(defaultValue = "50") int limit) {
        return game.messages().inbox(me.playerId(), type, limit).stream().map(MessageDto::of).toList();
    }

    @GetMapping("/messages/unread")
    public Map<String, Integer> unread(@AuthenticationPrincipal PlayerPrincipal me) {
        return Map.of("unread", game.messages().unread(me.playerId()));
    }

    @GetMapping("/messages/{id}")
    public MessageDto message(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        return MessageDto.of(game.messages().read(me.playerId(), id));
    }

    @PostMapping("/messages/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void readAll(@AuthenticationPrincipal PlayerPrincipal me) {
        game.messages().markAllRead(me.playerId());
    }

    @DeleteMapping("/messages/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMessage(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        game.messages().delete(me.playerId(), id);
    }

    @PostMapping("/messages")
    public MessageDto send(@AuthenticationPrincipal PlayerPrincipal me, @Valid @RequestBody SendMessageRequest req) {
        return MessageDto.of(game.messages().send(me.playerId(), req.to(), req.subject(), req.body()));
    }

    // --- sojusze

    public record CreateAllianceRequest(@NotBlank String tag, @NotBlank String name) {
    }

    public record TextRequest(String text) {
    }

    public record DecisionRequest(boolean accept) {
    }

    public record RankRequest(@NotNull Player.AllianceRank rank) {
    }

    public record AllianceSettingsRequest(String description, String homepage, Boolean open) {
    }

    public record CircularRequest(String subject, @NotBlank String body) {
    }

    public record TreatyRequest(@NotBlank String tag, @NotNull Treaty.Type type) {
    }

    @GetMapping("/alliances")
    public List<AllianceService.AllianceSummary> alliances() {
        return game.alliances().list();
    }

    @GetMapping("/alliances/{id}")
    public AllianceService.AllianceView alliance(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        return game.alliances().view(me.playerId(), id);
    }

    @PostMapping("/alliances")
    public AllianceService.AllianceView create(@AuthenticationPrincipal PlayerPrincipal me,
                                               @Valid @RequestBody CreateAllianceRequest req) {
        return game.alliances().create(me.playerId(), req.tag(), req.name());
    }

    @PostMapping("/alliances/{id}/apply")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void apply(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id, @RequestBody TextRequest req) {
        game.alliances().apply(me.playerId(), id, req.text());
    }

    @DeleteMapping("/alliances/application")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(@AuthenticationPrincipal PlayerPrincipal me) {
        game.alliances().withdrawApplication(me.playerId());
    }

    @PostMapping("/alliances/applications/{applicationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void decide(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long applicationId,
                       @RequestBody DecisionRequest req) {
        game.alliances().decideApplication(me.playerId(), applicationId, req.accept());
    }

    @PostMapping("/alliances/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@AuthenticationPrincipal PlayerPrincipal me) {
        game.alliances().leave(me.playerId());
    }

    @DeleteMapping("/alliances/members/{playerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void kick(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long playerId) {
        game.alliances().kick(me.playerId(), playerId);
    }

    @PutMapping("/alliances/members/{playerId}/rank")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rank(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long playerId,
                     @Valid @RequestBody RankRequest req) {
        game.alliances().setRank(me.playerId(), playerId, req.rank());
    }

    @PutMapping("/alliances/settings")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void settings(@AuthenticationPrincipal PlayerPrincipal me, @RequestBody AllianceSettingsRequest req) {
        game.alliances().update(me.playerId(), req.description(), req.homepage(), req.open());
    }

    @DeleteMapping("/alliances")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dissolve(@AuthenticationPrincipal PlayerPrincipal me) {
        game.alliances().dissolve(me.playerId());
    }

    @PostMapping("/alliances/circular")
    public Map<String, Integer> circular(@AuthenticationPrincipal PlayerPrincipal me,
                                         @Valid @RequestBody CircularRequest req) {
        return Map.of("recipients", game.alliances().circular(me.playerId(), req.subject(), req.body()));
    }

    @PostMapping("/alliances/treaties")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void proposeTreaty(@AuthenticationPrincipal PlayerPrincipal me, @Valid @RequestBody TreatyRequest req) {
        game.alliances().proposeTreaty(me.playerId(), req.tag(), req.type());
    }

    @PostMapping("/alliances/treaties/{id}/accept")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void acceptTreaty(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        game.alliances().acceptTreaty(me.playerId(), id);
    }

    @DeleteMapping("/alliances/treaties/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void endTreaty(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        game.alliances().endTreaty(me.playerId(), id);
    }

    // --- znajomi

    public record BuddyRequest(@NotBlank String username, String text) {
    }

    @GetMapping("/buddies")
    public List<pl.spacepioneers.game.service.BuddyService.BuddyView> buddies(@AuthenticationPrincipal PlayerPrincipal me) {
        return game.buddies().list(me.playerId());
    }

    @PostMapping("/buddies")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void requestBuddy(@AuthenticationPrincipal PlayerPrincipal me, @Valid @RequestBody BuddyRequest req) {
        game.buddies().request(me.playerId(), req.username(), req.text());
    }

    @PostMapping("/buddies/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void respondBuddy(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id,
                             @RequestBody DecisionRequest req) {
        game.buddies().respond(me.playerId(), id, req.accept());
    }

    @DeleteMapping("/buddies/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeBuddy(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        game.buddies().remove(me.playerId(), id);
    }

    // --- ranking

    @GetMapping("/ranking")
    public Views.RankingPage ranking(@AuthenticationPrincipal PlayerPrincipal me,
                                     @RequestParam(defaultValue = "players") String type,
                                     @RequestParam(defaultValue = "total") String category,
                                     @RequestParam(required = false) Integer page) {
        int p = page == null ? ("players".equals(type) ? game.ranking().pageOf(me.playerId()) : 1) : page;
        return game.ranking().page(type, category, p);
    }

    // --- rynek

    public record ExchangeRequest(@NotNull ResourceType from, @NotNull ResourceType to, long amount) {
    }

    @GetMapping("/market/{planetId}")
    public MarketService.Offer market(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long planetId) {
        return game.market().offer(me.playerId(), planetId);
    }

    @PostMapping("/market/{planetId}")
    public MarketService.ExchangeResult exchange(@AuthenticationPrincipal PlayerPrincipal me,
                                                 @PathVariable long planetId, @Valid @RequestBody ExchangeRequest req) {
        return game.market().exchange(me.playerId(), planetId, req.from(), req.to(), req.amount());
    }
}
