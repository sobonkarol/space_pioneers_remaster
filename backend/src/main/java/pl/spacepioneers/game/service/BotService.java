package pl.spacepioneers.game.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import pl.spacepioneers.engine.Rules;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.UnitDef;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.bot.BotNames;
import pl.spacepioneers.game.model.BotBrain;
import pl.spacepioneers.game.model.BotBrain.Personality;
import pl.spacepioneers.game.model.BotBrain.Strategy;
import pl.spacepioneers.game.model.BotBrain.Target;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.store.Json;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Gracze sterowani przez komputer. Graja przez te same serwisy co ludzie (te same zasady, ochrona nowych,
 * dyplomacja, koszty, czasy) i widza tylko to, co widzialby gracz: wlasne planety, galaktyke, raporty.
 *
 * <p>Tura bota: raporty -> obrona przed nadlatujacym atakiem -> budowa -> badania -> stocznia -> floty
 * (szpiegowanie, atak po symulacji walki, recykling, kolonizacja, ekspedycje) -> uczenie -> nastepna tura.
 * Uczenie: pamiec celow (lup/straty), pamiec napastnikow i wybor glownego kierunku rozwoju
 * (bandyta epsilon-zachlanny na przyroscie punktow, lupach i stratach).
 */
public final class BotService extends ServiceBase {

    private static final Logger log = LoggerFactory.getLogger(BotService.class);
    private static final ZoneId ZONE = ZoneId.of("Europe/Warsaw");
    private static final Duration LEARNING_PERIOD = Duration.ofHours(6);
    private static final int MAX_TARGETS = 50;
    private static final List<String> NON_COMBAT = List.of("small_cargo", "large_cargo", "freighter", "colony_ship",
            "recycler", "espionage_probe", "solar_satellite");
    private static final List<String> COMBAT_ORDER = List.of("destroyer", "battleship", "cruiser", "bomber",
            "heavy_fighter", "light_fighter");
    private static final List<String> DEFENSE_MIX = List.of("rocket_launcher", "light_laser", "heavy_laser",
            "gauss_cannon", "ion_cannon", "plasma_turret");

    private final Game game;
    /** Kiedy ktory bot ma nastepna ture - zeby nie czytac wszystkich graczy co kilka sekund. */
    private final Map<Long, Instant> schedule = new ConcurrentHashMap<>();
    private volatile Instant scheduleLoadedAt;
    private volatile Instant lastSpawnCheck;
    private final java.util.concurrent.atomic.AtomicLong failedTurns = new java.util.concurrent.atomic.AtomicLong();

    BotService(GameContext ctx, World world, Game game) {
        super(ctx, world);
        this.game = game;
    }

    // ------------------------------------------------------------------ zakladanie kont

    /**
     * Zaklada nowe boty, az bedzie ich {@code target}, najwyzej {@code perWeek} w ciagu 7 dni, rozlozone rowno w czasie.
     * Nie dziala na pustym serwerze - pierwsze konto (administrator) musi zalozyc czlowiek.
     */
    public int spawnDue(int target, int perWeek) {
        Instant now = ctx.now();
        // sprawdzamy co kilka minut - odczyt wszystkich graczy (z pamiecia botow) nie jest darmowy
        if (lastSpawnCheck != null && lastSpawnCheck.isAfter(now.minus(Duration.ofMinutes(5)))) return 0;
        lastSpawnCheck = now;
        List<Player> all = read(t -> ctx.store().players());
        if (all.stream().noneMatch(p -> !p.isBot())) return 0;
        long bots = all.stream().filter(Player::isBot).count();
        long thisWeek = all.stream().filter(p -> p.isBot() && p.getCreatedAt() != null
                && p.getCreatedAt().isAfter(now.minus(Duration.ofDays(7)))).count();
        if (bots >= target || thisWeek >= perWeek) return 0;
        // kolejne konto najwczesniej po ~1/perWeek tygodnia od poprzedniego (z losowym rozrzutem)
        Instant latest = all.stream().filter(Player::isBot).map(Player::getCreatedAt).filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder()).orElse(Instant.EPOCH);
        Duration gap = Duration.ofMinutes(7L * 24 * 60 / Math.max(1, perWeek));
        if (now.isAfter(latest.plus(gap.multipliedBy(7).dividedBy(10))) && ctx.random().nextInt(3) == 0) {
            create(ctx.random());
            return 1;
        }
        return 0;
    }

    /** Zaklada jednego bota z losowym charakterem i rytmem dnia; zwraca jego id. */
    public long create(Random r) {
        String name = BotNames.generate(r, n -> read(x -> ctx.store().playerByName(n).isPresent()));
        String email = name.toLowerCase().replaceAll("[^a-z0-9]", "") + "." + Long.toString(r.nextLong() & 0xffffff, 36)
                + "@gracze.invalid";
        Player p = game.players().register(name, email, "!bot-bez-hasla!");
        BotBrain brain = newBrain(r);
        brain.setNextTurn(ctx.now().plusSeconds(60 + r.nextInt(600)));
        txRun(now -> {
            Player fresh = ctx.requirePlayer(p.getId());
            fresh.setBot(brain);
            fresh.setEmailVerified(true);
            fresh.setTermsVersion(PlayerService.TERMS_VERSION);
            fresh.setTermsAcceptedAt(now);
            ctx.store().save(fresh);
        });
        schedule.put(p.getId(), brain.getNextTurn());
        log.info("Nowy gracz komputerowy: {} ({})", name, brain.getPersonality());
        return p.getId();
    }

    static BotBrain newBrain(Random r) {
        BotBrain b = new BotBrain();
        Personality pers = Personality.values()[r.nextInt(Personality.values().length)];
        b.setPersonality(pers);
        Map<Strategy, Double> w = new EnumMap<>(Strategy.class);
        for (Strategy s : Strategy.values()) w.put(s, 1.0);
        switch (pers) {
            case MINER -> { w.put(Strategy.ECONOMY, 2.0); w.put(Strategy.FLEET, 0.5); w.put(Strategy.DEFENSE, 1.2); }
            case RAIDER -> { w.put(Strategy.FLEET, 2.2); w.put(Strategy.DEFENSE, 0.4); w.put(Strategy.RESEARCH, 1.2); }
            case TURTLE -> { w.put(Strategy.DEFENSE, 2.2); w.put(Strategy.FLEET, 0.5); w.put(Strategy.ECONOMY, 1.4); }
            case EXPLORER -> { w.put(Strategy.EXPANSION, 2.2); w.put(Strategy.RESEARCH, 1.4); w.put(Strategy.FLEET, 0.8); }
            case BALANCED -> { }
        }
        // kazdy bot troche inny
        w.replaceAll((k, v) -> v * (0.8 + r.nextDouble() * 0.4));
        b.setWeights(w);
        // aktywnosc: zapalency, regularni, niedzielni
        int kind = r.nextInt(10);
        if (kind < 2) { b.setMinInterval(5); b.setMaxInterval(25); }
        else if (kind < 7) { b.setMinInterval(20); b.setMaxInterval(90); }
        else { b.setMinInterval(90); b.setMaxInterval(300); }
        b.setSleepHour((22 + r.nextInt(4)) % 24);
        b.setSleepHours(5 + r.nextInt(4));
        b.setFocus(pers == Personality.RAIDER ? Strategy.FLEET : Strategy.ECONOMY);
        return b;
    }

    // ------------------------------------------------------------------ harmonogram

    /** Rozgrywa zalegle tury (najwyzej {@code max}); zwraca liczbe rozegranych. */
    public int runDue(int max) {
        Instant now = ctx.now();
        if (scheduleLoadedAt == null || scheduleLoadedAt.isBefore(now.minus(Duration.ofMinutes(10)))) reloadSchedule(now);
        List<Long> due = schedule.entrySet().stream()
                .filter(e -> e.getValue() == null || !e.getValue().isAfter(now))
                .sorted(Map.Entry.comparingByValue(Comparator.nullsFirst(Comparator.naturalOrder())))
                .limit(max).map(Map.Entry::getKey).toList();
        for (Long id : due) {
            try {
                turn(id);
            } catch (RuntimeException e) {
                failedTurns.incrementAndGet();
                log.warn("Tura gracza komputerowego {} nieudana: {} w {}", id, e.toString(),
                        e.getStackTrace().length > 0 ? java.util.Arrays.toString(java.util.Arrays.copyOf(e.getStackTrace(), Math.min(4, e.getStackTrace().length))) : "?");
                schedule.put(id, now.plus(Duration.ofMinutes(15)));
            }
        }
        return due.size();
    }

    private void reloadSchedule(Instant now) {
        schedule.clear();
        for (Player p : read(t -> ctx.store().players())) {
            if (p.isBot()) schedule.put(p.getId(), p.getBot().getNextTurn());
        }
        scheduleLoadedAt = now;
    }

    /** Liczba tur zakonczonych bledem (nie GameException) od startu - do testow i diagnostyki. */
    public long failedTurns() {
        return failedTurns.get();
    }

    public int botCount() {
        return (int) read(t -> ctx.store().players()).stream().filter(Player::isBot).count();
    }

    // ------------------------------------------------------------------ tura

    /** Jedna tura bota. */
    public void turn(long botId) {
        Player me = read(now -> ctx.requirePlayer(botId));
        if (!me.isBot()) {
            schedule.remove(botId);
            return;
        }
        BotBrain brain = me.getBot();
        Random r = ctx.random();
        Turn t = new Turn(botId, brain, r);
        if (!me.inVacation() && !me.banned(ctx.now())) {
            t.readReports();
            List<Views.PlanetRef> planets = game.planets().planets(botId).stream().filter(p -> !p.moon()).toList();
            t.chooseBranch();
            for (Views.PlanetRef planet : planets) {
                t.defend(planet, planets);
                // najpierw czesc na wojsko (wg charakteru), dopiero reszta na budynki - inaczej budowa zjada wszystko
                t.shipyard(planet);
                t.economy(planet);
            }
            t.research(planets);
            t.military(planets);
            t.learn();
            attempt(() -> game.messages().deleteAll(botId, null));
        }
        Instant next = nextTurn(brain, ctx.now(), r);
        brain.setNextTurn(next);
        brain.setTurns(brain.getTurns() + 1);
        txRun(now -> {
            Player fresh = ctx.requirePlayer(botId);
            fresh.setBot(brain);
            fresh.setLastActivity(now);
            ctx.store().save(fresh);
        });
        schedule.put(botId, next);
    }

    /** Nastepna tura: losowa przerwa wg aktywnosci, z nocnym snem (czas polski). */
    static Instant nextTurn(BotBrain b, Instant now, Random r) {
        Instant next = now.plusSeconds(60L * (b.getMinInterval() + r.nextInt(Math.max(1, b.getMaxInterval() - b.getMinInterval() + 1))));
        ZonedDateTime local = next.atZone(ZONE);
        int hour = local.getHour();
        int start = b.getSleepHour() % 24;
        int end = (start + b.getSleepHours()) % 24;
        boolean asleep = start < end ? hour >= start && hour < end : hour >= start || hour < end;
        if (asleep) {
            ZonedDateTime wake = local.withHour(end).withMinute(r.nextInt(50)).withSecond(0);
            if (!wake.isAfter(local)) wake = wake.plusDays(1);
            next = wake.toInstant();
        }
        return next;
    }

    /** Ruch, ktory moze byc w tej chwili niedozwolony (brak surowcow, slotow, ochrona...) - wtedy pusty wynik. */
    private static <T> Optional<T> attempt(java.util.function.Supplier<T> action) {
        try {
            return Optional.ofNullable(action.get());
        } catch (GameException e) {
            return Optional.empty();
        }
    }

    // ------------------------------------------------------------------ logika jednej tury

    private final class Turn {
        final long id;
        final BotBrain b;
        final Random r;
        /** Planety przejrzane w galaktyce w tej turze: wspolrzedne -> wiersz. */
        final Map<String, Views.GalaxyRow> seen = new LinkedHashMap<>();
        final Map<String, Views.GalaxyView> systems = new HashMap<>();

        Turn(long id, BotBrain b, Random r) {
            this.id = id;
            this.b = b;
            this.r = r;
        }

        double share(Strategy s) {
            double sum = 0;
            for (Strategy x : Strategy.values()) sum += b.weight(x);
            return b.weight(s) / sum;
        }

        // ---------- raporty: nauka z walk i szpiegowania

        void readReports() {
            for (Message m : game.messages().inbox(id, Message.Type.ESPIONAGE, 100)) {
                if (m.payload() == null) continue;
                Reports.EspionageReport rep = Json.read(m.payload(), Reports.EspionageReport.class);
                Target tg = b.getTargets().computeIfAbsent(rep.coordinates() + (rep.moon() ? "m" : ""), k -> new Target());
                tg.ownerId = rep.ownerId();
                tg.ownerName = rep.ownerName();
                tg.moon = rep.moon();
                tg.lastReport = rep.at();
                tg.resources = rep.resources().total();
                tg.fleet = rep.fleet();
                tg.defense = rep.defense();
                // nauka: raport bez obrony = za malo sond na technologie celu
                if (rep.defense() == null) tg.probes = Math.min(24, Math.max(4, tg.probes) * 2);
                if (rep.probesDestroyed()) tg.probes = Math.max(4, tg.probes - 2);
                if (rep.research() != null) tg.research = rep.research();
            }
            for (Message m : game.messages().inbox(id, Message.Type.COMBAT, 100)) {
                if (m.payload() == null) continue;
                Reports.CombatReport rep = Json.read(m.payload(), Reports.CombatReport.class);
                boolean attacker = rep.attackers().stream().anyMatch(s -> s.playerId() == id);
                if (attacker) {
                    Target tg = b.getTargets().get(rep.coordinates());
                    double loot = rep.loot() == null ? 0 : rep.loot().total();
                    double lost = rep.attackerLostValue() == null ? 0 : rep.attackerLostValue().total();
                    if (tg != null) {
                        tg.loot += loot;
                        tg.losses += lost;
                    }
                    b.setFocusLoot(b.getFocusLoot() + loot);
                    b.setFocusLosses(b.getFocusLosses() + lost);
                } else {
                    double lost = rep.defenderLostValue() == null ? 0 : rep.defenderLostValue().total();
                    double stolen = rep.loot() == null ? 0 : rep.loot().total();
                    b.setFocusLosses(b.getFocusLosses() + lost + stolen);
                    for (Reports.Side s : rep.attackers()) b.getAttackedBy().merge(s.playerId(), 1, Integer::sum);
                    // nauka: kazda bolesna strata przesuwa bota w strone obrony
                    if (lost + stolen > 5000) {
                        b.getWeights().merge(Strategy.DEFENSE, 1.0, (a, x) -> Math.min(3.0, a * 1.04));
                    }
                }
            }
            if (b.getTargets().size() > MAX_TARGETS) {
                // zapominamy najdawniej odwiedzane cele
                List<String> old = b.getTargets().entrySet().stream()
                        .sorted(Comparator.comparing(e -> last(e.getValue())))
                        .limit(b.getTargets().size() - MAX_TARGETS).map(Map.Entry::getKey).toList();
                old.forEach(b.getTargets()::remove);
            }
        }

        Instant last(Target t) {
            Instant a = t.lastReport == null ? Instant.EPOCH : t.lastReport;
            Instant c = t.lastAttack == null ? Instant.EPOCH : t.lastAttack;
            return a.isAfter(c) ? a : c;
        }

        // ---------- specjalizacja

        void chooseBranch() {
            Player me = read(now -> ctx.requirePlayer(id));
            if (me.getBranch() != Branch.NONE || me.getScore().total() < Rules.BRANCH_MIN_POINTS) return;
            Branch branch = switch (b.getPersonality()) {
                case RAIDER, TURTLE -> Branch.WARRIOR;
                case MINER -> Branch.TRADER;
                default -> r.nextBoolean() ? Branch.WARRIOR : Branch.TRADER;
            };
            attempt(() -> game.players().chooseBranch(id, branch));
        }

        // ---------- obrona: ucieczka floty i surowcow przed silniejszym napastnikiem

        void defend(Views.PlanetRef planet, List<Views.PlanetRef> all) {
            Views.Overview ov = game.planets().overview(id, planet.id());
            Instant now = ctx.now();
            Optional<Views.FleetMovement> threat = ov.fleets().stream()
                    .filter(f -> !f.own() && "OUTBOUND".equals(f.status()) && "ATTACK".equals(f.mission())
                            && f.target().equals(planet.coordinates()) && !f.targetMoon()
                            && f.arriveAt().isBefore(now.plus(Duration.ofMinutes(40))))
                    .findFirst();
            if (threat.isEmpty()) return;
            double mine = ov.points();
            String attackerName = threat.get().ownerName();
            double theirs = read(x -> ctx.store().playerByName(attackerName).map(p -> p.getScore().total()).orElse(mine));
            if (theirs < mine * 0.8 && b.weight(Strategy.DEFENSE) > 1.2) return; // slabszy - przyjmujemy walke
            FleetService.DispatchInfo d = game.fleets().dispatchInfo(id, planet.id());
            Map<String, Long> ships = flying(d.ships());
            if (!ships.isEmpty() && d.slotsUsed() < d.slotsMax()) {
                Optional<Views.PlanetRef> refuge = all.stream().filter(p -> p.id() != planet.id()).findAny();
                long capacity = d.ships().entrySet().stream().mapToLong(e -> e.getValue() * ctx.data().unit(e.getKey()).cargo()).sum();
                Resources cargo = cargoOf(d.resources(), Math.max(0, capacity - 5_000));
                if (refuge.isPresent()) {
                    attempt(() -> game.fleets().send(id, new FleetService.SendRequest(planet.id(), ships, refuge.get().coordinates(),
                            Fleet.Mission.DEPLOY, 10, cargo)));
                } else if (d.expeditionsMax() > d.expeditionsUsed()) {
                    Coordinates c = Coordinates.parse(planet.coordinates());
                    String deep = c.galaxy() + ":" + c.system() + ":" + (ctx.config().positions() + 1);
                    attempt(() -> game.fleets().send(id, new FleetService.SendRequest(planet.id(), ships, deep,
                            Fleet.Mission.EXPEDITION, 100, cargo, false, null, 1)));
                }
            }
            // reszta surowcow w obrone - napastnik nie zabierze tego, co zostalo wydane
            spend(planet.id(), 0.9, true);
        }

        Map<String, Long> flying(Map<String, Long> ships) {
            Map<String, Long> out = new LinkedHashMap<>();
            ships.forEach((k, v) -> {
                if (v > 0 && ctx.data().unit(k).canFly()) out.put(k, v);
            });
            return out;
        }

        Resources cargoOf(Resources available, long capacity) {
            double cap = capacity;
            double m = Math.min(Math.floor(available.metal()), cap / 2);
            double c = Math.min(Math.floor(available.crystal()), cap - m);
            double t = Math.min(Math.floor(available.tritium() * 0.5), cap - m - c);
            return Resources.of(m, Math.max(0, c), Math.max(0, t));
        }

        // ---------- budowa

        void economy(Views.PlanetRef planet) {
            // kolejka ma wystarczyc do nastepnej wizyty (rzadko grajacy bot kolejkuje wiecej), najwyzej 5 pozycji
            long gapSeconds = 60L * (b.getMinInterval() + b.getMaxInterval()) / 2;
            for (int i = 0; i < PlanetService.MAX_BUILD_QUEUE; i++) {
                Views.Overview ov = game.planets().overview(id, planet.id());
                // czas trwa tylko pierwsza pozycja kolejki (pozostale nie maja jeszcze konca) - szacujemy reszte tak samo
                Instant firstEnd = ov.buildQueue().isEmpty() ? null : ov.buildQueue().get(0).end();
                long queued = firstEnd == null ? 0
                        : Math.max(0, Duration.between(ctx.now(), firstEnd).getSeconds()) * ov.buildQueue().size();
                if (ov.buildQueue().size() >= PlanetService.MAX_BUILD_QUEUE || (i > 0 || !ov.buildQueue().isEmpty()) && queued >= gapSeconds) {
                    return;
                }
                if (!enqueueBest(planet, ov)) return;
            }
        }

        /** Dodaje do kolejki najlepszy osiagalny budynek; false, gdy bot woli oszczedzac albo nie ma co budowac. */
        boolean enqueueBest(Views.PlanetRef planet, Views.Overview ov) {
            List<Views.UpgradeOption> options = game.planets().buildings(id, planet.id());
            Views.ResourceState res = ov.resources();
            double energy = res.energyProduced() - res.energyUsed();
            // kopalnia, ktorej nie da sie rozbudowac z braku energii = trzeba elektrowni
            boolean energyBlocked = options.stream().anyMatch(o -> o.energyDelta() != null && o.energyDelta() < 0
                    && o.missing().isEmpty() && o.blocker() == null && energy + o.energyDelta() < 0);
            Views.UpgradeOption best = null;
            double bestScore = 0;
            for (Views.UpgradeOption o : options) {
                if (!o.missing().isEmpty() || o.blocker() != null) continue;
                // oszczedzamy tylko na to, co da sie uzbierac w kilka godzin przy obecnym wydobyciu
                if (hoursToAfford(o.cost(), res) > 4) continue;
                double s = buildingPriority(o, ov, energy, energyBlocked) / Math.pow(Math.max(1, o.cost().total()), 0.25);
                if (s > bestScore) {
                    bestScore = s;
                    best = o;
                }
            }
            if (best == null) return false;
            if (!best.affordable()) {
                // nieosiagalny - bot oszczedza (stocznia wyda tylko nadwyzke ponad koszt)
                reserve.put(planet.id(), best.cost());
                return false;
            }
            String key = best.key();
            return attempt(() -> game.planets().enqueue(id, planet.id(), key)).isPresent();
        }

        final Map<Long, Resources> reserve = new HashMap<>();

        /** Ile godzin wydobycia brakuje do kosztu (nieskonczonosc, gdy brakujacego surowca planeta nie wytwarza). */
        double hoursToAfford(Resources cost, Views.ResourceState rs) {
            double[] need = {cost.metal() - rs.amount().metal(), cost.crystal() - rs.amount().crystal(),
                    cost.tritium() - rs.amount().tritium()};
            double[] rate = {rs.perHour().metal(), rs.perHour().crystal(), rs.perHour().tritium()};
            double h = 0;
            for (int i = 0; i < 3; i++) {
                if (need[i] <= 0) continue;
                if (rate[i] <= 0) return Double.POSITIVE_INFINITY;
                h = Math.max(h, need[i] / rate[i]);
            }
            return h;
        }

        double buildingPriority(Views.UpgradeOption o, Views.Overview ov, double energy, boolean energyBlocked) {
            double eco = b.weight(Strategy.ECONOMY), fleet = b.weight(Strategy.FLEET), def = b.weight(Strategy.DEFENSE);
            double res = b.weight(Strategy.RESEARCH), exp = b.weight(Strategy.EXPANSION);
            Views.ResourceState rs = ov.resources();
            int lvl = o.level();
            double delta = o.energyDelta() == null ? 0 : o.energyDelta();
            int fieldsLeft = ov.fieldsMax() - ov.fieldsUsed();
            return switch (o.key()) {
                case "metal_mine" -> energy + delta < 0 ? 0 : eco * 3.0;
                case "crystal_mine" -> energy + delta < 0 ? 0 : eco * 2.6;
                case "tritium_synthesizer" -> energy + delta < 0 ? 0
                        : rs.perHour().tritium() <= 0 ? 20 : eco * (1.2 + fleet * 0.6) * (lvl < 3 ? 2 : 1);
                case "solar_plant" -> energy < 0 || energyBlocked ? 50 : energy < 30 ? eco * 2.0 : 0.2;
                case "fusion_plant" -> (energy < 0 || energyBlocked) && lvl < 1 && rs.perHour().tritium() > 300 ? 30
                        : energyBlocked && rs.perHour().tritium() > 300 ? 45 : 0;
                case "robotics_factory" -> lvl < 10 ? 1.8 * eco : 0.2;
                case "nanite_factory" -> 2.0;
                case "shipyard" -> lvl < 3 ? 2.5 : lvl < 8 ? 1.0 * (fleet + def) : 0.2;
                case "research_lab" -> lvl < 3 ? 3.0 : lvl < 12 ? 1.2 * res : 0.2;
                case "metal_storage" -> full(rs, 0) ? 30 : 0;
                case "crystal_storage" -> full(rs, 1) ? 30 : 0;
                case "tritium_tank" -> full(rs, 2) ? 20 : 0;
                case "terraformer" -> fieldsLeft < 6 ? 25 : 0;
                case "missile_silo" -> def > 1.8 && lvl < 2 ? 0.5 : 0;
                case "trade_center" -> 0.6;
                case "war_academy" -> 0.8 * fleet;
                default -> 0 * exp;
            } / (1 + lvl * 0.04);
        }

        boolean full(Views.ResourceState rs, int which) {
            double[] a = {rs.amount().metal(), rs.amount().crystal(), rs.amount().tritium()};
            double[] c = {rs.capacity().metal(), rs.capacity().crystal(), rs.capacity().tritium()};
            return a[which] > c[which] * 0.75;
        }

        // ---------- badania

        void research(List<Views.PlanetRef> planets) {
            if (planets.isEmpty()) return;
            Views.Overview ov = game.planets().overview(id, planets.get(0).id());
            if (ov.research() != null) return;
            // badanie prowadzimy z planety z najwiekszym laboratorium (ta jest pierwsza z listy wg serwisu - wystarczy macierzysta)
            List<Views.UpgradeOption> options = game.research().list(id, planets.get(0).id());
            Views.UpgradeOption best = null;
            double bestScore = 0;
            for (Views.UpgradeOption o : options) {
                if (!o.missing().isEmpty() || o.blocker() != null || !o.affordable()) continue;
                double s = researchPriority(o.key()) * unlockBonus(o.key(), o.level()) / (1 + o.level() * 0.6);
                if (s > bestScore) {
                    bestScore = s;
                    best = o;
                }
            }
            if (best != null) {
                String key = best.key();
                attempt(() -> game.research().start(id, planets.get(0).id(), key));
            }
        }

        /** Badania prowadzace do sond, transportowcow i kolonizacji maja pierwszenstwo, dopoki nie sa osiagniete. */
        double unlockBonus(String key, int level) {
            return switch (key) {
                case "combustion_drive" -> level < 3 ? 3.0 : 1;
                case "espionage_tech" -> level < 2 ? 3.0 : level < 4 ? 1.5 : 1;
                case "impulse_drive" -> level < 3 ? 1.6 : 1;
                case "astrophysics" -> level < 1 ? 1.8 : 1;
                default -> 1;
            };
        }

        double researchPriority(String key) {
            double fleet = b.weight(Strategy.FLEET), def = b.weight(Strategy.DEFENSE), res = b.weight(Strategy.RESEARCH);
            double exp = b.weight(Strategy.EXPANSION);
            return switch (key) {
                case "energy_tech" -> 2.0 * res;
                case "computer_tech" -> 1.5 * (fleet + exp) / 2;
                case "combustion_drive" -> 2.0 * fleet;
                case "impulse_drive" -> 1.4 * (fleet + exp) / 2;
                case "hyperspace_drive" -> 0.8 * fleet;
                case "espionage_tech" -> 1.3 * fleet;
                case "astrophysics" -> 2.0 * exp;
                case "weapons_tech" -> 1.4 * (fleet + def) / 2;
                case "shielding_tech" -> 1.2 * (fleet + def) / 2;
                case "armour_tech" -> 1.3 * (fleet + def) / 2;
                case "laser_tech" -> 1.0 * (fleet + def) / 2;
                case "ion_tech" -> 0.8 * (fleet + def) / 2;
                case "plasma_tech" -> 0.6 * (fleet + def) / 2;
                case "hyperspace_tech" -> 0.6 * res;
                default -> 0.3;
            };
        }

        // ---------- stocznia

        void shipyard(Views.PlanetRef planet) {
            double military = share(Strategy.FLEET) + share(Strategy.DEFENSE) + share(Strategy.EXPANSION) * 0.3;
            spend(planet.id(), Math.min(0.7, military * 1.2), false);
        }

        /** Wydaje czesc wolnych surowcow na statki i obrone wg wag (panic = tylko obrona). */
        void spend(long planetId, double fraction, boolean panic) {
            Views.Overview ov = game.planets().overview(id, planetId);
            if (ov.shipyardQueue().size() >= 6) return;
            Resources have = ov.resources().amount();
            Resources keep = reserve.getOrDefault(planetId, Resources.ZERO);
            double free = Math.max(0, have.metal() - keep.metal()) + Math.max(0, have.crystal() - keep.crystal());
            if (free < 3_000) return;
            // podzial budzetu wojskowego miedzy flote i obrone (wzgledny)
            double fl = share(Strategy.FLEET) + share(Strategy.EXPANSION) * 0.3;
            double df = share(Strategy.DEFENSE) * (b.getPersonality() == Personality.TURTLE ? 1.0 : 0.6);
            double fleetShare = panic ? 0 : fl / (fl + df);
            double defShare = panic ? 1 : df / (fl + df);
            double budget = free * fraction;
            List<Views.UnitOption> ships = game.shipyard().list(id, planetId, UnitDef.UnitType.SHIP);
            List<Views.UnitOption> defense = game.shipyard().list(id, planetId, UnitDef.UnitType.DEFENSE);
            Map<String, Views.UnitOption> available = new HashMap<>();
            for (Views.UnitOption o : ships) if (o.missing().isEmpty() && o.blocker() == null) available.put(o.key(), o);
            for (Views.UnitOption o : defense) if (o.missing().isEmpty() && o.blocker() == null) available.put(o.key(), o);
            FleetService.DispatchInfo d = game.fleets().dispatchInfo(id, planetId);
            Map<String, Long> owned = d.ships();

            if (!panic) {
                // statki pomocnicze: sondy, transportowce, recyklery, kolonizator
                long probes = owned.getOrDefault("espionage_probe", 0L);
                boolean probesQueued = ov.shipyardQueue().stream().anyMatch(q -> q.unit().equals("espionage_probe"));
                long wantProbes = b.weight(Strategy.FLEET) > 1.5 ? 16 : 8;
                if (!probesQueued && probes < wantProbes) order(available, planetId, "espionage_probe", wantProbes - probes);
                double cargoCap = owned.getOrDefault("small_cargo", 0L) * 5_000.0 + owned.getOrDefault("large_cargo", 0L) * 25_000.0;
                if (cargoCap < Math.max(10_000, free * 0.5)) {
                    order(available, planetId, available.containsKey("large_cargo") ? "large_cargo" : "small_cargo", 1 + r.nextInt(3));
                }
                if (b.weight(Strategy.EXPANSION) > 1.3 && owned.getOrDefault("recycler", 0L) < 4) order(available, planetId, "recycler", 1);
                int maxPlanets = Rules.maxPlanets(read(now -> ctx.requirePlayer(id)).researchLevel("astrophysics"));
                if (planetCount() < maxPlanets && owned.getOrDefault("colony_ship", 0L) == 0) order(available, planetId, "colony_ship", 1);
                // flota bojowa: najsilniejszy dostepny typ, czasem tanszy dla masy
                String combat = COMBAT_ORDER.stream().filter(available::containsKey).findFirst().orElse(null);
                if (combat != null && fleetShare > 0) {
                    if (r.nextInt(3) == 0) {
                        String cheaper = COMBAT_ORDER.stream().filter(available::containsKey).skip(1).findFirst().orElse(combat);
                        combat = cheaper;
                    }
                    orderBudget(available, planetId, combat, budget * fleetShare);
                }
            }
            // obrona: mieszanka tanich i mocnych dzial, kopuly raz
            if (defShare > 0) {
                order(available, planetId, "small_shield_dome", 1);
                order(available, planetId, "large_shield_dome", 1);
                List<String> guns = DEFENSE_MIX.stream().filter(available::containsKey).toList();
                if (!guns.isEmpty()) {
                    double defBudget = budget * defShare;
                    orderBudget(available, planetId, guns.get(0), defBudget * 0.4);
                    orderBudget(available, planetId, guns.get(guns.size() - 1), defBudget * 0.6);
                }
            }
        }

        int planetCount() {
            return (int) game.planets().planets(id).stream().filter(p -> !p.moon()).count();
        }

        void order(Map<String, Views.UnitOption> available, long planetId, String key, long count) {
            Views.UnitOption o = available.get(key);
            if (o == null || o.maxBuildable() <= 0) return;
            long n = Math.min(count, o.maxBuildable());
            if (n > 0) attempt(() -> game.shipyard().order(id, planetId, key, n));
        }

        void orderBudget(Map<String, Views.UnitOption> available, long planetId, String key, double budget) {
            Views.UnitOption o = available.get(key);
            if (o == null) return;
            double unit = Math.max(1, o.cost().metal() + o.cost().crystal());
            long n = (long) Math.floor(budget / unit);
            if (n > 0) order(available, planetId, key, n);
        }

        // ---------- floty

        void military(List<Views.PlanetRef> planets) {
            if (planets.isEmpty()) return;
            Views.PlanetRef home = planets.get(0);
            scan(home);
            for (Views.PlanetRef planet : planets) {
                FleetService.DispatchInfo d = game.fleets().dispatchInfo(id, planet.id());
                if (d.slotsUsed() >= d.slotsMax()) return;
                if (colonize(planet, d)) continue;
                if (attack(planet, d)) continue;
                if (recycle(planet, d)) continue;
                if (spy(planet, d)) continue;
                expedition(planet, d);
            }
        }

        /** Przeglada 2 uklady w okolicy (na zmiane w obie strony), jak gracz klikajacy po galaktyce. */
        void scan(Views.PlanetRef home) {
            Coordinates c = Coordinates.parse(home.coordinates());
            int systemsMax = ctx.config().systems();
            int reach = 3 + (int) Math.round(6 * share(Strategy.FLEET) + 4 * share(Strategy.EXPANSION));
            for (int i = 0; i < 2; i++) {
                int k = b.getScanOffset();
                b.setScanOffset((k + 1) % (2 * reach + 1));
                int off = k == 0 ? 0 : (k % 2 == 1 ? (k + 1) / 2 : -(k / 2));
                int sys = c.system() + off;
                if (sys < 1 || sys > systemsMax) continue;
                Views.GalaxyView view = game.galaxy().system(id, c.galaxy(), sys);
                systems.put(c.galaxy() + ":" + sys, view);
                for (Views.GalaxyRow row : view.rows()) {
                    String coords = c.galaxy() + ":" + sys + ":" + row.position();
                    seen.put(coords, row);
                    if (row.planetId() == null || row.own() || row.ownerId() == null) continue;
                    if (row.flags().stream().anyMatch(f -> f.equals("v") || f.equals("b") || f.equals("n")
                            || f.equals("s") || f.equals("A"))) {
                        b.getTargets().remove(coords);
                        continue;
                    }
                    Target tg = b.getTargets().computeIfAbsent(coords, x -> new Target());
                    tg.ownerId = row.ownerId();
                    tg.ownerName = row.ownerName();
                }
            }
        }

        boolean inactive(String coords) {
            Views.GalaxyRow row = seen.get(coords);
            return row != null && row.flags().stream().anyMatch(f -> f.equals("i") || f.equals("I"));
        }

        boolean spy(Views.PlanetRef from, FleetService.DispatchInfo d) {
            long probes = d.ships().getOrDefault("espionage_probe", 0L);
            if (probes == 0) return false;
            Instant now = ctx.now();
            String pick = null;
            double bestScore = 0;
            for (var e : b.getTargets().entrySet()) {
                Target t = e.getValue();
                if (e.getKey().endsWith("m")) continue;
                if (t.lastSpy != null && t.lastSpy.isAfter(now.minus(Duration.ofHours(3)))) continue;
                if (t.rejected >= 3 || (t.attacks >= 2 && t.losses > t.loot)) continue;
                double s = 1 + (inactive(e.getKey()) ? 3 : 0) + (t.loot > 0 ? Math.min(5, t.loot / 20_000) : 0)
                        + (b.getAttackedBy().containsKey(t.ownerId) ? 2 : 0) + r.nextDouble();
                if (s > bestScore) {
                    bestScore = s;
                    pick = e.getKey();
                }
            }
            if (pick == null) return false;
            String target = pick;
            // tyle sond, ile ten cel wymagal ostatnio (bot uczy sie, ilu potrzeba na jego technologie)
            long n = Math.min(probes, Math.max(3, b.getTargets().get(pick).probes));
            Optional<Views.FleetMovement> sent = attempt(() -> game.fleets().send(id, new FleetService.SendRequest(from.id(),
                    Map.of("espionage_probe", n), target, Fleet.Mission.ESPIONAGE, 100, Resources.ZERO)));
            Target t = b.getTargets().get(target);
            t.lastSpy = now;
            if (sent.isEmpty()) t.rejected++;
            return sent.isPresent();
        }

        boolean attack(Views.PlanetRef from, FleetService.DispatchInfo d) {
            Instant now = ctx.now();
            Map<String, Long> combat = new LinkedHashMap<>();
            Map<String, Long> cargoShips = new LinkedHashMap<>();
            d.ships().forEach((k, v) -> {
                if (v <= 0 || !ctx.data().unit(k).canFly()) return;
                if (k.equals("small_cargo") || k.equals("large_cargo") || k.equals("freighter")) cargoShips.put(k, v);
                else if (!NON_COMBAT.contains(k)) combat.put(k, v);
            });
            if (cargoShips.isEmpty()) return false;
            double aggression = share(Strategy.FLEET) * 5;
            for (var e : b.getTargets().entrySet()) {
                Target t = e.getValue();
                if (t.lastReport == null || t.lastReport.isBefore(now.minus(Duration.ofHours(3)))) continue;
                if (t.lastAttack != null && t.lastAttack.isAfter(t.lastReport)) continue;
                if (t.fleet == null || t.defense == null) continue;
                double loot = t.resources * ctx.config().lootRatio();
                if (loot < 3_000) continue;
                boolean defenseless = t.fleet.values().stream().allMatch(v -> v == 0)
                        && t.defense.values().stream().allMatch(v -> v == 0);
                Map<String, Long> send = new LinkedHashMap<>();
                double winRate = 1.0, lossValue = 0;
                if (!defenseless) {
                    if (combat.isEmpty()) continue;
                    SimulatorService.Side mine = game.simulator().ownTechnology(id);
                    Map<String, Integer> enemyTech = t.research == null ? Map.of() : t.research;
                    Map<String, Long> enemy = new HashMap<>(t.fleet);
                    t.defense.forEach((k, v) -> enemy.merge(k, v, Long::sum));
                    enemy.keySet().removeIf(k -> ctx.data().findUnit(k).map(UnitDef::isMissile).orElse(true));
                    if (enemy.isEmpty()) continue;
                    SimulatorService.Side att = new SimulatorService.Side(combat, mine.weapons(), mine.shielding(), mine.armour(),
                            mine.attackBonusPercent());
                    SimulatorService.Side def = new SimulatorService.Side(enemy,
                            enemyTech.getOrDefault("weapons_tech", mine.weapons()),
                            enemyTech.getOrDefault("shielding_tech", mine.shielding()),
                            enemyTech.getOrDefault("armour_tech", mine.armour()), 0);
                    SimulatorService.Result sim = attempt(() -> game.simulator().simulate(att, def, 12)).orElse(null);
                    if (sim == null) continue;
                    winRate = sim.attackerWins() / (double) sim.runs();
                    lossValue = sim.attackerLoss().total();
                    double needed = b.getPersonality() == Personality.RAIDER ? 0.65 : 0.8;
                    if (winRate < needed || loot - lossValue * (1.5 - aggression * 0.1) < 0) {
                        t.rejected++;
                        continue;
                    }
                    send.putAll(combat);
                }
                // transportowce w liczbie potrzebnej na lup (z zapasem)
                long capNeed = (long) (loot * 1.1);
                for (var c : cargoShips.entrySet()) {
                    long per = ctx.data().unit(c.getKey()).cargo();
                    long n = Math.min(c.getValue(), (capNeed + per - 1) / per);
                    if (n > 0) {
                        send.put(c.getKey(), n);
                        capNeed -= n * per;
                    }
                    if (capNeed <= 0) break;
                }
                String coords = e.getKey();
                Optional<Views.FleetMovement> sent = attempt(() -> game.fleets().send(id, new FleetService.SendRequest(from.id(),
                        send, coords, Fleet.Mission.ATTACK, 100, Resources.ZERO)));
                if (sent.isPresent()) {
                    t.lastAttack = now;
                    t.attacks++;
                    return true;
                }
                t.rejected++;
            }
            return false;
        }

        boolean recycle(Views.PlanetRef from, FleetService.DispatchInfo d) {
            long recyclers = d.ships().getOrDefault("recycler", 0L);
            if (recyclers == 0) return false;
            for (var e : seen.entrySet()) {
                Resources debris = e.getValue().debris();
                if (debris == null || debris.total() < 5_000) continue;
                long n = Math.min(recyclers, (long) Math.ceil(debris.total() / ctx.data().unit("recycler").cargo()));
                String coords = e.getKey();
                if (attempt(() -> game.fleets().send(id, new FleetService.SendRequest(from.id(), Map.of("recycler", n), coords,
                        Fleet.Mission.RECYCLE, 100, Resources.ZERO))).isPresent()) return true;
            }
            return false;
        }

        boolean colonize(Views.PlanetRef from, FleetService.DispatchInfo d) {
            if (d.ships().getOrDefault("colony_ship", 0L) == 0) return false;
            List<String> free = new ArrayList<>();
            for (var e : seen.entrySet()) {
                int pos = Coordinates.parse(e.getKey()).position();
                if (e.getValue().planetId() == null && pos >= 4 && pos <= 12) free.add(e.getKey());
            }
            if (free.isEmpty()) return false;
            String target = free.get(r.nextInt(free.size()));
            Resources start = cargoOf(d.resources(), 5_000);
            return attempt(() -> game.fleets().send(id, new FleetService.SendRequest(from.id(), Map.of("colony_ship", 1L), target,
                    Fleet.Mission.COLONIZE, 100, start))).isPresent();
        }

        void expedition(Views.PlanetRef from, FleetService.DispatchInfo d) {
            if (d.expeditionsMax() <= d.expeditionsUsed()) return;
            if (r.nextDouble() > 0.15 + share(Strategy.EXPANSION)) return;
            Map<String, Long> ships = new LinkedHashMap<>();
            long cargo = d.ships().getOrDefault("small_cargo", 0L);
            long fighters = d.ships().getOrDefault("light_fighter", 0L);
            if (cargo > 0) ships.put("small_cargo", Math.max(1, cargo / 3));
            if (fighters > 0) ships.put("light_fighter", Math.max(1, fighters / 4));
            if (ships.isEmpty()) return;
            Coordinates c = Coordinates.parse(from.coordinates());
            String deep = c.galaxy() + ":" + c.system() + ":" + (ctx.config().positions() + 1);
            int hours = 1 + r.nextInt(3);
            attempt(() -> game.fleets().send(id, new FleetService.SendRequest(from.id(), ships, deep, Fleet.Mission.EXPEDITION,
                    100, Resources.ZERO, false, null, hours)));
        }

        // ---------- uczenie: ktory kierunek rozwoju oplaca sie temu botowi

        void learn() {
            Instant now = ctx.now();
            double points = read(t -> ctx.requirePlayer(id)).getScore().total();
            if (b.getFocusSince() == null) {
                b.setFocusSince(now);
                b.setFocusStartPoints(points);
                return;
            }
            Duration elapsed = Duration.between(b.getFocusSince(), now);
            if (elapsed.compareTo(LEARNING_PERIOD) < 0) return;
            double hours = Math.max(1, elapsed.toMinutes() / 60.0);
            double reward = ((points - b.getFocusStartPoints()) + (b.getFocusLoot() - b.getFocusLosses()) / 1000.0) / hours;
            Strategy f = b.getFocus();
            int n = b.getRewardCounts().getOrDefault(f, 0);
            double avg = b.getRewards().getOrDefault(f, reward);
            b.getRewards().put(f, n == 0 ? reward : avg + (reward - avg) * 0.3);
            b.getRewardCounts().put(f, n + 1);
            double mean = b.getRewards().values().stream().mapToDouble(Double::doubleValue).average().orElse(reward);
            b.getWeights().merge(f, 1.0, (w, x) -> Math.max(0.3, Math.min(3.0, w * (reward >= mean ? 1.06 : 0.94))));
            // kolejny kierunek: czasem eksperyment, zwykle najlepszy dotad (niesprawdzone - optymistycznie)
            Strategy next;
            if (r.nextDouble() < 0.2) {
                next = Strategy.values()[r.nextInt(Strategy.values().length)];
            } else {
                next = Strategy.ECONOMY;
                double best = Double.NEGATIVE_INFINITY;
                for (Strategy s : Strategy.values()) {
                    double v = b.getRewardCounts().getOrDefault(s, 0) == 0 ? mean * 1.2 + 0.01 : b.getRewards().get(s);
                    v *= b.getWeights().getOrDefault(s, 1.0);
                    if (v > best) {
                        best = v;
                        next = s;
                    }
                }
            }
            b.setFocus(next);
            b.setFocusSince(now);
            b.setFocusStartPoints(points);
            b.setFocusLoot(0);
            b.setFocusLosses(0);
        }
    }
}
