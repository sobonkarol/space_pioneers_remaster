package pl.spacepioneers.api;

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
import pl.spacepioneers.game.service.BoardService;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.security.PlayerPrincipal;

/** Publiczne forum gry. Odczyt bez logowania (GET), zapis dla zalogowanych. */
@RestController
@RequestMapping("/api/board")
public class BoardController {

    private final Game game;

    public BoardController(Game game) {
        this.game = game;
    }

    public record ThreadRequest(String category, String title, String text) {
    }

    public record PostRequest(String text) {
    }

    public record ModerateRequest(Boolean pinned, Boolean locked, String status) {
    }

    private static Long id(PlayerPrincipal me) {
        return me == null ? null : me.playerId();
    }

    @GetMapping
    public BoardService.IndexView index(@AuthenticationPrincipal PlayerPrincipal me) {
        return game.board().index(id(me));
    }

    @GetMapping("/categories/{category}")
    public BoardService.CategoryPage category(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable String category,
                                              @RequestParam(defaultValue = "1") int page) {
        return game.board().category(id(me), category, page);
    }

    @GetMapping("/threads/{id}")
    public BoardService.ThreadPage thread(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id,
                                          @RequestParam(defaultValue = "1") int page) {
        return game.board().thread(id(me), id, page);
    }

    @PostMapping("/threads")
    public BoardService.ThreadView create(@AuthenticationPrincipal PlayerPrincipal me, @RequestBody ThreadRequest req) {
        return game.board().create(me.playerId(), req.category(), req.title(), req.text());
    }

    @PostMapping("/threads/{id}/posts")
    public BoardService.PostView reply(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id,
                                       @RequestBody PostRequest req) {
        return game.board().reply(me.playerId(), id, req.text());
    }

    @PutMapping("/threads/{id}")
    public BoardService.ThreadView moderate(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id,
                                            @RequestBody ModerateRequest req) {
        return game.board().moderate(me.playerId(), id, req.pinned(), req.locked(), req.status());
    }

    @DeleteMapping("/threads/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteThread(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        game.board().deleteThread(me.playerId(), id);
    }

    @PutMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void edit(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id, @RequestBody PostRequest req) {
        game.board().edit(me.playerId(), id, req.text());
    }

    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(@AuthenticationPrincipal PlayerPrincipal me, @PathVariable long id) {
        game.board().deletePost(me.playerId(), id);
    }
}
