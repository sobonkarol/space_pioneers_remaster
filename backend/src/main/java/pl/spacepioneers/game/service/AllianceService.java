package pl.spacepioneers.game.service;

import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Alliance;
import pl.spacepioneers.game.model.AllianceApplication;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Player.AllianceRank;
import pl.spacepioneers.game.model.Treaty;
import pl.spacepioneers.game.store.GameStore;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;

/** Sojusze: zakladanie, czlonkostwo, rangi, okolnik, dyplomacja. */
public final class AllianceService extends ServiceBase {

    private static final Pattern TAG = Pattern.compile("^[\\p{L}\\p{N}_.-]{2,8}$");
    private static final Pattern NAME = Pattern.compile("^[\\p{L}\\p{N} _.'-]{3,40}$");

    private final Mailer mailer;

    public AllianceService(GameContext ctx, World world, Mailer mailer) {
        super(ctx, world);
        this.mailer = mailer;
    }

    public record MemberView(long playerId, String name, String rank, double points, int playerRank,
                             Instant lastActivity, String homeCoordinates) {
    }

    public record ApplicationView(long id, long playerId, String playerName, double points, String text,
                                  Instant createdAt) {
    }

    public record TreatyView(long id, long otherAllianceId, String otherTag, String otherName, String type,
                             String status, boolean proposedByUs, Instant createdAt) {
    }

    public record AllianceView(long id, String tag, String name, String description, String homepage,
                               boolean open, Instant createdAt, double points, int rank, int memberCount,
                               List<MemberView> members, List<ApplicationView> applications,
                               List<TreatyView> treaties, String myRank) {
    }

    public record AllianceSummary(long id, String tag, String name, int members, double points, int rank, boolean open) {
    }

    // --- odczyt

    public List<AllianceSummary> list() {
        return read(now -> ctx.store().alliances().stream()
                .map(a -> new AllianceSummary(a.getId(), a.getTag(), a.getName(),
                        ctx.store().playersOfAlliance(a.getId()).size(), Math.floor(a.getScore().total()), a.getRank(),
                        a.isOpenForApplications()))
                .sorted(Comparator.comparingDouble(AllianceSummary::points).reversed())
                .toList());
    }

    /** Widok sojuszu; czlonkowie i dyplomacja sa widoczni dla wszystkich, wnioski tylko dla kierownictwa. */
    public AllianceView view(long viewerId, long allianceId) {
        return read(now -> {
            Alliance a = ctx.store().alliance(allianceId).orElseThrow(() -> GameException.notFound("sojusz " + allianceId));
            Player viewer = ctx.requirePlayer(viewerId);
            boolean member = viewer.getAllianceId() != null && viewer.getAllianceId() == allianceId;
            boolean leader = member && viewer.getAllianceRank() != AllianceRank.MEMBER;
            List<Player> members = ctx.store().playersOfAlliance(allianceId);
            List<MemberView> memberViews = members.stream()
                    .sorted(Comparator.comparing((Player p) -> p.getAllianceRank().ordinal())
                            .thenComparing(p -> -p.getScore().total()))
                    .map(p -> new MemberView(p.getId(), p.getUsername(), p.getAllianceRank().name(),
                            Math.floor(p.getScore().total()), p.getRank(), member ? p.getLastActivity() : null,
                            ctx.store().planet(p.getHomePlanetId()).map(x -> x.coordinates().toString()).orElse(null)))
                    .toList();
            List<ApplicationView> apps = leader ? ctx.store().applications(allianceId).stream()
                    .map(x -> {
                        Player p = ctx.requirePlayer(x.playerId());
                        return new ApplicationView(x.id(), p.getId(), p.getUsername(), Math.floor(p.getScore().total()),
                                x.text(), x.createdAt());
                    }).toList() : List.of();
            List<TreatyView> treaties = ctx.store().treaties(allianceId).stream()
                    .filter(t -> member || t.status() == Treaty.Status.ACTIVE)
                    .map(t -> {
                        Alliance other = ctx.store().alliance(t.other(allianceId)).orElse(null);
                        return new TreatyView(t.id(), t.other(allianceId), other == null ? "?" : other.getTag(),
                                other == null ? "?" : other.getName(), t.type().name(), t.status().name(),
                                t.proposedBy() == allianceId, t.createdAt());
                    }).toList();
            return new AllianceView(a.getId(), a.getTag(), a.getName(), a.getDescription(), a.getHomepage(),
                    a.isOpenForApplications(), a.getCreatedAt(), Math.floor(a.getScore().total()), a.getRank(),
                    members.size(), memberViews, apps, treaties,
                    member ? viewer.getAllianceRank().name() : null);
        });
    }

    // --- zakladanie i czlonkostwo

    public AllianceView create(long playerId, String tag, String name) {
        long id = ctx.store().inTransaction(() -> {
            Instant now = ctx.now();
            world.catchUp(now);
            GameStore store = ctx.store();
            Player p = ctx.requirePlayer(playerId);
            if (p.getAllianceId() != null) {
                throw new GameException("already_member", "Należysz już do sojuszu.");
            }
            String t = tag == null ? "" : tag.trim();
            String n = name == null ? "" : name.trim();
            if (!TAG.matcher(t).matches()) throw new GameException("invalid_tag", "Tag: 2-8 znaków.");
            if (!NAME.matcher(n).matches()) throw new GameException("invalid_name", "Nazwa: 3-40 znaków.");
            if (store.allianceByTag(t).isPresent()) {
                throw new GameException(GameException.Kind.CONFLICT, "tag_taken", "Ten tag jest zajęty.");
            }
            Alliance a = new Alliance(store.nextId("alliance"), t, n, playerId, now);
            a.setScore(p.getScore());
            store.save(a);
            store.applicationOf(playerId).ifPresent(x -> store.deleteApplication(x.id()));
            p.setAllianceId(a.getId());
            p.setAllianceRank(AllianceRank.FOUNDER);
            store.save(p);
            return a.getId();
        });
        return view(playerId, id);
    }

    public void apply(long playerId, long allianceId, String text) {
        txRun(now -> {
            GameStore store = ctx.store();
            Player p = ctx.requirePlayer(playerId);
            if (p.getAllianceId() != null) throw new GameException("already_member", "Należysz już do sojuszu.");
            Alliance a = store.alliance(allianceId).orElseThrow(() -> GameException.notFound("sojusz " + allianceId));
            if (!a.isOpenForApplications()) throw new GameException("closed", "Sojusz nie przyjmuje zgłoszeń.");
            if (store.applicationOf(playerId).isPresent()) {
                throw new GameException("already_applied", "Masz już złożone zgłoszenie.");
            }
            store.save(new AllianceApplication(store.nextId("application"), allianceId, playerId,
                    MessageService.clean(text, 2000), now));
            for (Player leader : leaders(allianceId)) {
                mailer.system(leader.getId(), Message.Type.ALLIANCE, "Nowe zgłoszenie do sojuszu",
                        "Gracz " + p.getUsername() + " chce dołączyć do sojuszu [" + a.getTag() + "].", now);
            }
        });
    }

    public void withdrawApplication(long playerId) {
        txRun(now -> {
            AllianceApplication app = ctx.store().applicationOf(playerId)
                    .orElseThrow(() -> GameException.notFound("zgłoszenie"));
            ctx.store().deleteApplication(app.id());
        });
    }

    public void decideApplication(long leaderId, long applicationId, boolean accept) {
        txRun(now -> {
            GameStore store = ctx.store();
            Player leader = requireLeader(leaderId);
            AllianceApplication app = store.application(applicationId)
                    .filter(x -> x.allianceId() == leader.getAllianceId())
                    .orElseThrow(() -> GameException.notFound("zgłoszenie " + applicationId));
            store.deleteApplication(app.id());
            Player applicant = ctx.requirePlayer(app.playerId());
            Alliance a = store.alliance(leader.getAllianceId()).orElseThrow();
            if (accept) {
                if (applicant.getAllianceId() != null) {
                    throw new GameException("already_member", "Gracz należy już do innego sojuszu.");
                }
                applicant.setAllianceId(a.getId());
                applicant.setAllianceRank(AllianceRank.MEMBER);
                store.save(applicant);
            }
            mailer.system(applicant.getId(), Message.Type.ALLIANCE,
                    accept ? "Przyjęto do sojuszu" : "Odrzucono zgłoszenie",
                    accept ? "Zostałeś przyjęty do sojuszu [" + a.getTag() + "] " + a.getName() + "."
                            : "Sojusz [" + a.getTag() + "] odrzucił twoje zgłoszenie.", now);
        });
    }

    public void leave(long playerId) {
        txRun(now -> {
            Player p = ctx.requirePlayer(playerId);
            if (p.getAllianceId() == null) throw new GameException("no_alliance", "Nie należysz do sojuszu.");
            if (p.getAllianceRank() == AllianceRank.FOUNDER) {
                throw new GameException("founder_cannot_leave",
                        "Założyciel nie może opuścić sojuszu - przekaż przywództwo lub rozwiąż sojusz.");
            }
            p.setAllianceId(null);
            p.setAllianceRank(null);
            ctx.store().save(p);
        });
    }

    public void kick(long leaderId, long memberId) {
        txRun(now -> {
            Player leader = requireLeader(leaderId);
            Player m = ctx.requirePlayer(memberId);
            if (m.getAllianceId() == null || !m.getAllianceId().equals(leader.getAllianceId())) {
                throw GameException.notFound("członek " + memberId);
            }
            if (m.getAllianceRank() == AllianceRank.FOUNDER
                    || (m.getAllianceRank() == AllianceRank.OFFICER && leader.getAllianceRank() != AllianceRank.FOUNDER)) {
                throw GameException.forbidden("Nie możesz wyrzucić tego członka.");
            }
            m.setAllianceId(null);
            m.setAllianceRank(null);
            ctx.store().save(m);
            mailer.system(m.getId(), Message.Type.ALLIANCE, "Usunięto z sojuszu",
                    "Zostałeś usunięty z sojuszu.", now);
        });
    }

    public void setRank(long founderId, long memberId, AllianceRank rank) {
        txRun(now -> {
            Player founder = requireFounder(founderId);
            Player m = ctx.requirePlayer(memberId);
            if (m.getAllianceId() == null || !m.getAllianceId().equals(founder.getAllianceId()) || m.getId() == founderId) {
                throw GameException.notFound("członek " + memberId);
            }
            if (rank == AllianceRank.FOUNDER) {
                // przekazanie przywodztwa
                founder.setAllianceRank(AllianceRank.OFFICER);
                ctx.store().save(founder);
                Alliance a = ctx.store().alliance(founder.getAllianceId()).orElseThrow();
                a.setFounderId(m.getId());
                ctx.store().save(a);
            }
            m.setAllianceRank(rank);
            ctx.store().save(m);
        });
    }

    public void update(long leaderId, String description, String homepage, Boolean open) {
        txRun(now -> {
            Player leader = requireLeader(leaderId);
            Alliance a = ctx.store().alliance(leader.getAllianceId()).orElseThrow();
            if (description != null) a.setDescription(MessageService.clean(description, 5000));
            if (homepage != null) {
                String h = MessageService.clean(homepage, 200);
                if (!h.isEmpty() && !h.startsWith("https://") && !h.startsWith("http://")) {
                    throw new GameException("invalid_homepage", "Adres strony musi zaczynać się od http(s)://");
                }
                a.setHomepage(h);
            }
            if (open != null) a.setOpenForApplications(open);
            ctx.store().save(a);
        });
    }

    public void dissolve(long founderId) {
        txRun(now -> {
            Player founder = requireFounder(founderId);
            long allianceId = founder.getAllianceId();
            GameStore store = ctx.store();
            for (Player m : store.playersOfAlliance(allianceId)) {
                m.setAllianceId(null);
                m.setAllianceRank(null);
                store.save(m);
                if (m.getId() != founderId) {
                    mailer.system(m.getId(), Message.Type.ALLIANCE, "Sojusz rozwiązany", "Twój sojusz został rozwiązany.", now);
                }
            }
            store.applications(allianceId).forEach(x -> store.deleteApplication(x.id()));
            store.treaties(allianceId).forEach(t -> store.deleteTreaty(t.id()));
            store.deleteAlliance(allianceId);
        });
    }

    public int circular(long leaderId, String subject, String body) {
        return tx(now -> {
            Player leader = requireLeader(leaderId);
            Alliance a = ctx.store().alliance(leader.getAllianceId()).orElseThrow();
            String b = MessageService.clean(body, MessageService.MAX_BODY);
            if (b.isEmpty()) throw new GameException("empty_message", "Treść wiadomości jest pusta.");
            String s = MessageService.clean(subject, MessageService.MAX_SUBJECT);
            List<Player> members = ctx.store().playersOfAlliance(a.getId());
            for (Player m : members) {
                mailer.send(m.getId(), leader.getId(), leader.getUsername(), Message.Type.ALLIANCE,
                        "[" + a.getTag() + "] " + (s.isEmpty() ? "Okólnik" : s), b, null, now);
            }
            return members.size();
        });
    }

    // --- dyplomacja

    public void proposeTreaty(long leaderId, String otherTag, Treaty.Type type) {
        txRun(now -> {
            GameStore store = ctx.store();
            Player leader = requireLeader(leaderId);
            long mine = leader.getAllianceId();
            Alliance other = store.allianceByTag(otherTag == null ? "" : otherTag.trim())
                    .orElseThrow(() -> new GameException(GameException.Kind.NOT_FOUND, "no_alliance", "Nie ma takiego sojuszu."));
            if (other.getId() == mine) throw new GameException("self_treaty", "Nie można zawrzeć traktatu z samym sobą.");
            if (type == null) throw new GameException("invalid_treaty", "Wybierz rodzaj traktatu.");
            boolean exists = store.treaties(mine).stream().anyMatch(t -> t.other(mine) == other.getId());
            if (exists) {
                throw new GameException("treaty_exists", "Z tym sojuszem istnieje już traktat - najpierw go zakończ.");
            }
            Alliance own = store.alliance(mine).orElseThrow();
            Treaty.Status status = type == Treaty.Type.WAR ? Treaty.Status.ACTIVE : Treaty.Status.PROPOSED;
            store.save(new Treaty(store.nextId("treaty"), mine, other.getId(), type, status, mine, now));
            String what = switch (type) {
                case WAR -> "wypowiedział wam wojnę";
                case DEFENSE_PACT -> "proponuje pakt obronny";
                case TRADE_PACT -> "proponuje pakt handlowy";
                case NON_AGGRESSION -> "proponuje pakt o nieagresji";
            };
            for (Player l : leaders(other.getId())) {
                mailer.system(l.getId(), Message.Type.ALLIANCE, "Dyplomacja",
                        "Sojusz [" + own.getTag() + "] " + what + ".", now);
            }
        });
    }

    public void acceptTreaty(long leaderId, long treatyId) {
        txRun(now -> {
            Player leader = requireLeader(leaderId);
            long mine = leader.getAllianceId();
            Treaty t = ctx.store().treaty(treatyId).filter(x -> x.involves(mine))
                    .orElseThrow(() -> GameException.notFound("traktat " + treatyId));
            if (t.status() != Treaty.Status.PROPOSED || t.proposedBy() == mine) {
                throw new GameException("cannot_accept", "Tego traktatu nie można zaakceptować.");
            }
            ctx.store().save(t.activate());
        });
    }

    /** Zakonczenie traktatu, odrzucenie propozycji albo zawarcie pokoju (dla wojny). */
    public void endTreaty(long leaderId, long treatyId) {
        txRun(now -> {
            Player leader = requireLeader(leaderId);
            long mine = leader.getAllianceId();
            Treaty t = ctx.store().treaty(treatyId).filter(x -> x.involves(mine))
                    .orElseThrow(() -> GameException.notFound("traktat " + treatyId));
            ctx.store().deleteTreaty(t.id());
        });
    }

    // --- pomocnicze

    private List<Player> leaders(long allianceId) {
        return ctx.store().playersOfAlliance(allianceId).stream()
                .filter(p -> p.getAllianceRank() != AllianceRank.MEMBER).toList();
    }

    private Player requireLeader(long playerId) {
        Player p = ctx.requirePlayer(playerId);
        if (p.getAllianceId() == null) throw new GameException("no_alliance", "Nie należysz do sojuszu.");
        if (p.getAllianceRank() == AllianceRank.MEMBER) {
            throw GameException.forbidden("Ta akcja wymaga rangi oficera lub założyciela.");
        }
        return p;
    }

    private Player requireFounder(long playerId) {
        Player p = requireLeader(playerId);
        if (p.getAllianceRank() != AllianceRank.FOUNDER) {
            throw GameException.forbidden("Ta akcja wymaga rangi założyciela.");
        }
        return p;
    }
}
