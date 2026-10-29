package pl.spacepioneers.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.spacepioneers.account.AdminLog;
import pl.spacepioneers.account.EmailSender;
import pl.spacepioneers.account.LogEmailSender;

import java.util.List;

/** Dane publiczne: pregierz (lista blokad) i - tylko w srodowisku testowym - skrzynka wyslanych e-maili. */
@RestController
@RequestMapping("/api")
public class PublicController {

    private final AdminLog log;
    private final EmailSender sender;

    public PublicController(AdminLog log, EmailSender sender) {
        this.log = log;
        this.sender = sender;
    }

    public record PilloryEntry(java.time.Instant at, String adminName, String playerName, String reason, java.time.Instant until) {
    }

    @GetMapping("/pillory")
    public List<PilloryEntry> pillory() {
        return log.pillory(100).stream()
                .map(e -> new PilloryEntry(e.at(), e.adminName(), e.targetName(), e.details(), e.until()))
                .toList();
    }

    @GetMapping("/dev/outbox")
    public ResponseEntity<List<LogEmailSender.OutboxMail>> outbox() {
        if (sender instanceof LogEmailSender l && l.outboxEnabled()) {
            return ResponseEntity.ok(l.outbox());
        }
        return ResponseEntity.notFound().build();
    }
}
